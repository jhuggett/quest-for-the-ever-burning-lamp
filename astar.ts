import { konsole } from ".";

interface XY<T> {
  x(): number;
  y(): number;

  neighbors(): T[];

  isTraversable(): boolean;
}

export class AStarNode<T extends XY<T>> {
  constructor(
    public value: T,
    public g: number = 0,
    public h: number = 0,
    public f: number = 0,
    public parent: AStarNode<T> | null = null
  ) {}

  sameAs(node: AStarNode<T>) {
    return (
      this.value.x() === node.value.x() && this.value.y() === node.value.y()
    );
  }
}

export const astar = <T extends XY<T>>(start: T, end: T) => {
  const startNode = new AStarNode(start);
  const endNode = new AStarNode(end);

  let openSet = [startNode];
  const closedSet: AStarNode<T>[] = [];

  while (openSet.length > 0) {
    let currentIndex = 0;
    let currentNode = openSet[0];

    openSet.forEach((node, index) => {
      if (node.f < currentNode.f) {
        currentIndex = index;
        currentNode = node;
      }
    });

    openSet = openSet.filter((node) => !node.sameAs(currentNode));
    closedSet.push(currentNode);

    if (currentNode.sameAs(endNode)) {
      const path = [];
      let current: null | AStarNode<T> = currentNode;
      while (current) {
        path.push(current);
        current = current.parent;
      }

      if (path.length === 2) {
        // meaning the last step is the target
        return [];
      }

      return path
        .reverse()
        .map((node) => node.value)
        .slice(1);
    }

    let children: AStarNode<T>[] = [];

    currentNode.value.neighbors().forEach((neighbor) => {
      // When this is not commented out, the returned path is always undefined
      const node = new AStarNode(neighbor);
      node.parent = currentNode;

      if (!neighbor.isTraversable() && !node.sameAs(endNode)) {
        return;
      }

      children.push(node);
    });

    for (const child of children) {
      let childInClosed = false;
      for (const closed of closedSet) {
        if (child.sameAs(closed)) {
          childInClosed = true;
          break;
        }
      }
      if (childInClosed) {
        continue;
      }

      let childInOpen = false;
      for (const open of openSet) {
        if (child.sameAs(open)) {
          childInOpen = true;
          break;
        }
      }
      if (childInOpen) {
        continue;
      }

      child.g = currentNode.g + 1;
      child.h =
        (child.value.x() - endNode.value.x()) ** 2 +
        (child.value.y() - endNode.value.y()) ** 2;
      child.f = child.g + child.h;

      openSet.push(child);
    }
  }
};
