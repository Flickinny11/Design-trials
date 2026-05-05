// Node module stub for contact-social — replaced at codegen time (spec §9).
import { Group } from 'three';

export default function createNode(_config, _ctx) {
  const group = new Group();
  group.name = "contact-social";
  group.userData.cleanup = () => {};
  group.userData.handlers = {};
  return group;
}
