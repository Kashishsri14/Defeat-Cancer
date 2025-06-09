// import React from "react";
// import KanbanBoard from "../components/KanbanBoard";
// import { useLocation } from "react-router-dom";

// const ScreeningSchedule = () => {
//   const state = useLocation();
//   return (
//     <div className="w-full overflow-scroll ">
//       <KanbanBoard state={state} />;
//     </div>
//   );
// };

// export default ScreeningSchedule;

import React from "react";
import KanbanBoard from "../components/KanbanBoard";
import { useLocation } from "react-router-dom";

const ScreeningSchedule = () => {
  const location = useLocation();
  return (
    <div className="w-full overflow-scroll">
      <KanbanBoard state={location.state} />
    </div>
  );
};

export default ScreeningSchedule;
