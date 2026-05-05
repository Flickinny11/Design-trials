// Node module stub for landing-hero — replaced at codegen time (spec §9).
import { Group } from 'three';

export default function createNode(_config, _ctx) {
  const group = new Group();
  group.name = "landing-hero";
  group.userData.cleanup = () => {};
  group.userData.handlers = {};
  return group;
}
