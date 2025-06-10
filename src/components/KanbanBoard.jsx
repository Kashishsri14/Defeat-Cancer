

import React, { useMemo, useState, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove } from "@dnd-kit/sortable";
import { createPortal } from "react-dom";
import ColumnContainer from "./ColumnContainer";
import TaskCard from "./TaskCard";
import { IconPlus } from "@tabler/icons-react";

function KanbanBoard({ state }) {
  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeColumn, setActiveColumn] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Memoize columns ID to prevent unnecessary re-renders
  const columnsId = useMemo(() => columns.map((col) => col.id), [columns]);

  // Initialize data from state prop
  useEffect(() => {
    try {
      setIsLoading(true);
      setError(null);

      console.log("Received state:", state); // Debug log

      // Default columns if no state provided
      const defaultColumns = [
        { id: "todo", title: "Todo" },
        { id: "doing", title: "Work in progress" },
        { id: "done", title: "Done" },
      ];

      // If no state provided, use defaults
      if (!state) {
        console.log("No state provided, using defaults");
        setColumns(defaultColumns);
        setTasks([]);
        setIsLoading(false);
        return;
      }

      // Handle different possible state structures
      let stateData = null;

      // Check various possible nested state structures
      if (state?.state) {
        stateData = state.state;
      } else if (state?.columns || state?.tasks) {
        stateData = state;
      } else if (typeof state === "object") {
        stateData = state;
      }

      if (!stateData) {
        console.log("Invalid state data, using defaults");
        setColumns(defaultColumns);
        setTasks([]);
        setIsLoading(false);
        return;
      }

      // Validate and set columns
      let validatedCols = [];

      if (stateData.columns) {
        if (Array.isArray(stateData.columns)) {
          // If columns is an array
          validatedCols = stateData.columns.map((col, index) => ({
            id: col?.id || `col-${index}`,
            title: col?.title || `Column ${index + 1}`,
          }));
        } else if (typeof stateData.columns === "object") {
          // If columns is an object (key-value pairs)
          validatedCols = Object.entries(stateData.columns).map(
            ([key, col], index) => ({
              id: col?.id || key || `col-${index}`,
              title: col?.title || col?.name || key || `Column ${index + 1}`,
            }),
          );
        }
      }

      // If no valid columns found, use defaults
      if (validatedCols.length === 0) {
        console.log("No valid columns found, using defaults");
        validatedCols = defaultColumns;
      }

      // Validate and set tasks
      let validatedTasks = [];

      if (stateData.tasks) {
        if (Array.isArray(stateData.tasks)) {
          // If tasks is an array
          validatedTasks = stateData.tasks.map((task, index) => ({
            id: task?.id || `task-${index}`,
            columnId:
              task?.columnId || task?.status || validatedCols[0]?.id || "todo",
            content:
              task?.content ||
              task?.title ||
              task?.description ||
              `Task ${index + 1}`,
          }));
        } else if (typeof stateData.tasks === "object") {
          // If tasks is an object
          validatedTasks = Object.entries(stateData.tasks).map(
            ([key, task], index) => ({
              id: task?.id || key || `task-${index}`,
              columnId:
                task?.columnId ||
                task?.status ||
                validatedCols[0]?.id ||
                "todo",
              content:
                task?.content ||
                task?.title ||
                task?.description ||
                `Task ${index + 1}`,
            }),
          );
        }
      }

      // If columns have tasks nested within them, extract them
      if (validatedTasks.length === 0) {
        validatedCols.forEach((col) => {
          if (col.tasks && Array.isArray(col.tasks)) {
            col.tasks.forEach((task, index) => {
              validatedTasks.push({
                id: task?.id || `task-${col.id}-${index}`,
                columnId: col.id,
                content:
                  task?.content ||
                  task?.title ||
                  task?.description ||
                  `Task ${index + 1}`,
              });
            });
          }
        });
      }

      console.log("Validated columns:", validatedCols);
      console.log("Validated tasks:", validatedTasks);

      setColumns(validatedCols);
      setTasks(validatedTasks);
      setIsLoading(false);
    } catch (err) {
      console.error("Error initializing kanban board:", err);
      setError(err.message);
      setIsLoading(false);

      // Set default columns if initialization fails
      const defaultColumns = [
        { id: "todo", title: "Todo" },
        { id: "doing", title: "Work in progress" },
        { id: "done", title: "Done" },
      ];
      setColumns(defaultColumns);
      setTasks([]);
    }
  }, [state]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading kanban board...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <h2 className="mb-2 text-xl font-semibold text-red-600">
          Error Loading Board
        </h2>
        <p className="mb-4 text-gray-600 dark:text-gray-400">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5 min-h-screen w-full text-white">
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-bold text-gray-800 dark:text-white">
          Treatment Plan Tasks
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Drag and drop tasks between columns to track progress
        </p>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
      >
        <div className="m-auto flex gap-4 overflow-x-auto pb-4">
          <div className="flex gap-4">
            <SortableContext items={columnsId}>
              {columns.map((col) => (
                <ColumnContainer
                  key={col.id}
                  column={col}
                  deleteColumn={deleteColumn}
                  updateColumn={updateColumn}
                  createTask={createTask}
                  deleteTask={deleteTask}
                  updateTask={updateTask}
                  tasks={tasks.filter((task) => task.columnId === col.id)}
                />
              ))}
            </SortableContext>
          </div>
          <button
            onClick={createNewColumn}
            className="flex h-[60px] w-[350px] min-w-[350px] cursor-pointer gap-2 rounded-lg border-2 border-gray-300 bg-gray-50 p-4 text-gray-700 ring-green-500 transition-all hover:ring-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            <IconPlus />
            Add Column
          </button>
        </div>

        {createPortal(
          <DragOverlay>
            {activeColumn && (
              <ColumnContainer
                column={activeColumn}
                deleteColumn={deleteColumn}
                updateColumn={updateColumn}
                createTask={createTask}
                deleteTask={deleteTask}
                updateTask={updateTask}
                tasks={tasks.filter(
                  (task) => task.columnId === activeColumn.id,
                )}
              />
            )}
            {activeTask && (
              <TaskCard
                task={activeTask}
                deleteTask={deleteTask}
                updateTask={updateTask}
              />
            )}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
    </div>
  );

  function createTask(columnId) {
    const newTask = {
      id: generateId(),
      columnId,
      content: `Task ${tasks.length + 1}`,
    };
    setTasks((prevTasks) => [...prevTasks, newTask]);
  }

  function deleteTask(id) {
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
  }

  function updateTask(id, content) {
    setTasks((prevTasks) =>
      prevTasks.map((task) => (task.id === id ? { ...task, content } : task)),
    );
  }

  function createNewColumn() {
    const newColumn = {
      id: generateId(),
      title: `Column ${columns.length + 1}`,
    };
    setColumns((prevColumns) => [...prevColumns, newColumn]);
  }

  function deleteColumn(id) {
    setColumns((prevColumns) => prevColumns.filter((col) => col.id !== id));
    setTasks((prevTasks) => prevTasks.filter((task) => task.columnId !== id));
  }

  function updateColumn(id, title) {
    setColumns((prevColumns) =>
      prevColumns.map((col) => (col.id === id ? { ...col, title } : col)),
    );
  }

  function onDragStart(event) {
    if (event.active.data.current?.type === "Column") {
      setActiveColumn(event.active.data.current.column);
    } else if (event.active.data.current?.type === "Task") {
      setActiveTask(event.active.data.current.task);
    }
  }

  function onDragEnd(event) {
    setActiveColumn(null);
    setActiveTask(null);

    const { active, over } = event;
    if (!over) return;

    if (active.id === over.id) return;

    const isActiveAColumn = active.data.current?.type === "Column";
    if (isActiveAColumn) {
      setColumns((prevColumns) => {
        const activeIndex = prevColumns.findIndex(
          (col) => col.id === active.id,
        );
        const overIndex = prevColumns.findIndex((col) => col.id === over.id);
        return arrayMove(prevColumns, activeIndex, overIndex);
      });
    } else {
      const isActiveATask = active.data.current?.type === "Task";
      const isOverATask = over.data.current?.type === "Task";

      if (isActiveATask && isOverATask) {
        setTasks((prevTasks) => {
          const activeIndex = prevTasks.findIndex((t) => t.id === active.id);
          const overIndex = prevTasks.findIndex((t) => t.id === over.id);

          if (
            prevTasks[activeIndex].columnId !== prevTasks[overIndex].columnId
          ) {
            const updatedTasks = [...prevTasks];
            updatedTasks[activeIndex] = {
              ...updatedTasks[activeIndex],
              columnId: prevTasks[overIndex].columnId,
            };
            return arrayMove(updatedTasks, activeIndex, overIndex - 1);
          }
          return arrayMove(prevTasks, activeIndex, overIndex);
        });
      } else if (isActiveATask) {
        setTasks((prevTasks) => {
          const activeIndex = prevTasks.findIndex((t) => t.id === active.id);
          const updatedTasks = [...prevTasks];
          updatedTasks[activeIndex] = {
            ...updatedTasks[activeIndex],
            columnId: over.id,
          };
          return updatedTasks;
        });
      }
    }
  }

  function onDragOver(event) {
    const { active, over } = event;
    if (!over) return;

    if (active.id === over.id) return;

    const isActiveATask = active.data.current?.type === "Task";
    const isOverATask = over.data.current?.type === "Task";

    if (isActiveATask && isOverATask) {
      setTasks((prevTasks) => {
        const activeIndex = prevTasks.findIndex((t) => t.id === active.id);
        const overIndex = prevTasks.findIndex((t) => t.id === over.id);

        if (prevTasks[activeIndex].columnId !== prevTasks[overIndex].columnId) {
          const updatedTasks = [...prevTasks];
          updatedTasks[activeIndex] = {
            ...updatedTasks[activeIndex],
            columnId: prevTasks[overIndex].columnId,
          };
          return arrayMove(updatedTasks, activeIndex, overIndex - 1);
        }
        return arrayMove(prevTasks, activeIndex, overIndex);
      });
    } else if (isActiveATask) {
      setTasks((prevTasks) => {
        const activeIndex = prevTasks.findIndex((t) => t.id === active.id);
        const updatedTasks = [...prevTasks];
        updatedTasks[activeIndex] = {
          ...updatedTasks[activeIndex],
          columnId: over.id,
        };
        return updatedTasks;
      });
    }
  }
}

function generateId() {
  // Use timestamp + random for better uniqueness
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export default KanbanBoard;
