// Node module stub for features-grid — replaced at codegen time (spec §9).
import { Group } from 'three';

export default function createNode(_config, _ctx) {
  const group = new Group();
  group.name = "features-grid";
  group.userData.cleanup = () => {};
  group.userData.handlers = {};
  return group;
}
