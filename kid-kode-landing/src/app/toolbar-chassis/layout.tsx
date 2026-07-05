// Toolbar Chassis route layout — pulls in the full-bleed stage stylesheet (a
// global, NOT a CSS module: the no-dom-ui gate forbids CSS modules + styled
// className/inline-style chrome, not the single global that sizes the WebGL
// stage). Everything visible is rendered inside the <canvas>.

import './chassis.css';

export default function ChassisLayout({ children }: { children: React.ReactNode }) {
  return children;
}
