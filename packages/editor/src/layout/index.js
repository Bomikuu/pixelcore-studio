import { findNode, findParent, containers } from '@sitebuilder/core';
export function relativeMove(document, id, direction) {
  const parent = findParent(document, id);
  if (!parent) throw new Error('Select an element inside the page.');
  const i = parent.children.findIndex((n) => n.id === id);
  if ((direction < 0 && i === 0) || (direction > 0 && i === parent.children.length - 1))
    return null;
  return {
    type: 'move',
    id,
    parentId: parent.id,
    beforeId: direction < 0 ? parent.children[i - 1].id : parent.children[i + 2]?.id,
  };
}
export function dropOperation(document, id, targetId, inside = false) {
  const target = findNode(document, targetId);
  const parent = inside ? target : findParent(document, targetId);
  if (!target || !parent || !containers.includes(parent.type))
    throw new Error('Choose a section or container for this element.');
  return { type: 'move', id, parentId: parent.id, beforeId: inside ? undefined : target.id };
}
