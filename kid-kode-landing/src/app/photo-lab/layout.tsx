import type { ReactNode } from "react";
import "./photo-lab.css";

export default function PhotoLabLayout({ children }: { children: ReactNode }) {
  return <div className="photo-lab-root">{children}</div>;
}
