import React, { useState, useEffect } from "react";
import {
  IconChevronRight,
  IconFileUpload,
  IconProgress,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStateContext } from "../../context/index";
import ReactMarkdown from "react-markdown";
import FileUploadModal from "./components/file-upload-modal";
import RecordDetailsHeader from "./components/record-details-header";
import { GoogleGenerativeAI } from "@google/generative-ai";

const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

function SingleRecordDetails() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [processing, setIsProcessing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState("");
  const [filename, setFilename] = useState("");
  const [filetype, setFileType] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState(null);

  const { updateRecord } = useStateContext();

  // Initialize analysis result from state on component mount
  useEffect(() => {
    if (state?.analysisResult) {
      setAnalysisResult(state.analysisResult);
    }
  }, [state?.analysisResult]);

  // Add error boundary for missing state
  useEffect(() => {
    if (!state || !state.id) {
      setError("Invalid record state. Please navigate from the records list.");
    }
  }, [state]);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Reset file-related state when closing modal
    setFile(null);
    setFilename("");
    setFileType("");
    setUploadSuccess(false);
    setError(null);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      console.log("Selected file:", selectedFile);
      setFileType(selectedFile.type);
      setFilename(selectedFile.name);
      setFile(selectedFile);
      setError(null);
    }
  };

  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    if (!geminiApiKey) {
      setError("Gemini API key is not configured.");
      return;
    }

    setUploading(true);
    setUploadSuccess(false);
    setError(null);

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const base64Data = await readFileAsBase64(file);

      const imageParts = [
        {
          inlineData: {
            data: base64Data,
            mimeType: filetype,
          },
        },
      ];

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `You are an expert cancer and any disease diagnosis analyst. Use your knowledge base to answer questions about giving personalized recommended treatments.
        give a detailed treatment plan for me, make it more readable, clear and easy to understand make it paragraphs to make it more readable
        `;

      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const text = response.text();

      setAnalysisResult(text);

      // Only update record if we have a valid state
      if (state?.id) {
        await updateRecord({
          documentID: state.id,
          analysisResult: text,
          kanbanRecords: "",
        });
      }

      setUploadSuccess(true);
      setIsModalOpen(false);

      // Reset file state
      setFilename("");
      setFile(null);
      setFileType("");
    } catch (error) {
      console.error("Error uploading file:", error);
      setError(`Upload failed: ${error.message}`);
      setUploadSuccess(false);
    } finally {
      setUploading(false);
    }
  };

  const processTreatmentPlan = async () => {
    if (!analysisResult) {
      setError("No analysis result available. Please upload a file first.");
      return;
    }

    if (!geminiApiKey) {
      setError("Gemini API key is not configured.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `Your role and goal is to be an that will be using this treatment plan ${analysisResult} to create Columns:
                - Todo: Tasks that need to be started
                - Doing: Tasks that are in progress
                - Done: Tasks that are completed
          
                Each task should include a brief description. The tasks should be categorized appropriately based on the stage of the treatment process.
          
                Please provide the results in the following format for easy front-end display no quotation marks or extra formatting, just the pure JSON structure below:

                {
                  "columns": [
                    { "id": "todo", "title": "Todo" },
                    { "id": "doing", "title": "Work in progress" },
                    { "id": "done", "title": "Done" }
                  ],
                  "tasks": [
                    { "id": "1", "columnId": "todo", "content": "Example task 1" },
                    { "id": "2", "columnId": "todo", "content": "Example task 2" },
                    { "id": "3", "columnId": "doing", "content": "Example task 3" },
                    { "id": "4", "columnId": "doing", "content": "Example task 4" },
                    { "id": "5", "columnId": "done", "content": "Example task 5" }
                  ]
                }`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Clean the response text to ensure valid JSON
      const cleanedText = text.replace(/```json|```/g, "").trim();

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(cleanedText);
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${parseError.message}`);
      }

      console.log("Parsed response:", parsedResponse);

      // Only update record if we have a valid state
      if (state?.id) {
        await updateRecord({
          documentID: state.id,
          kanbanRecords: cleanedText,
        });
      }

      navigate("/screening-schedules", { state: parsedResponse });
    } catch (error) {
      console.error("Error processing treatment plan:", error);
      setError(`Processing failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Show error state if there's an error
  if (error && (!state || !state.id)) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <h2 className="mb-2 text-xl font-semibold text-red-600">Error</h2>
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-[26px]">
      {error && (
        <div className="mb-4 w-full rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleOpenModal}
        disabled={uploading || processing}
        className="mt-6 inline-flex items-center gap-x-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-[#13131a] dark:text-white dark:hover:bg-neutral-800"
      >
        <IconFileUpload />
        Upload Reports
      </button>

      <FileUploadModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onFileChange={handleFileChange}
        onFileUpload={handleFileUpload}
        uploading={uploading}
        uploadSuccess={uploadSuccess}
        filename={filename}
      />

      <RecordDetailsHeader recordName={state?.recordName || "Unknown Record"} />

      <div className="w-full">
        <div className="flex flex-col">
          <div className="-m-1.5 overflow-x-auto">
            <div className="inline-block min-w-full p-1.5 align-middle">
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-[#13131a]">
                <div className="border-b border-gray-200 px-6 py-4 dark:border-neutral-700">
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-neutral-200">
                    Personalized AI-Driven Treatment Plan
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-neutral-400">
                    A tailored medical strategy leveraging advanced AI insights.
                  </p>
                </div>
                <div className="flex w-full flex-col px-6 py-4 text-white">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                      Analysis Result
                    </h2>
                    <div className="space-y-2">
                      {analysisResult ? (
                        <ReactMarkdown>{analysisResult}</ReactMarkdown>
                      ) : (
                        <p className="italic text-gray-500 dark:text-gray-400">
                          No analysis result available. Please upload a medical
                          report to get started.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-5 grid gap-2 sm:flex">
                    <button
                      type="button"
                      onClick={processTreatmentPlan}
                      disabled={!analysisResult || processing || uploading}
                      className="inline-flex items-center gap-x-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
                    >
                      View Treatment plan
                      <IconChevronRight size={20} />
                      {processing && (
                        <IconProgress
                          size={20}
                          className="mr-3 h-5 w-5 animate-spin"
                        />
                      )}
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 border-t border-gray-200 px-6 py-4 md:flex md:items-center md:justify-between dark:border-neutral-700">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-neutral-400">
                      <span className="font-semibold text-gray-800 dark:text-neutral-200"></span>
                    </p>
                  </div>
                  <div>
                    <div className="inline-flex gap-x-2"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SingleRecordDetails;
