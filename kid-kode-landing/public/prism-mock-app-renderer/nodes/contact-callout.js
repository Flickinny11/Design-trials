// Node module stub for contact-callout — replaced at codegen time (spec §9).
import { Group } from 'three';

export default function createNode(_config, _ctx) {
  const group = new Group();
  group.name = "contact-callout";
  group.userData.cleanup = () => {};
  group.userData.handlers = {};
  return group;
}
