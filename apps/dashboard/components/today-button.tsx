import React from "react";
import { Button } from "@workspace/ui/components/button";

interface TodayButtonProps {
  onClick: () => void;
}

const TodayButton = ({ onClick }: TodayButtonProps) => {
  return (
    <Button variant="outline" onClick={onClick} className="text-[#6B9CA9]">
      Today
    </Button>
  );
};

export default TodayButton;
