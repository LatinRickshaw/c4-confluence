import { wouldCreateCycle } from '../src/lib/hierarchy';

describe('wouldCreateCycle', () => {
  it('rejects an element becoming its own parent', () => {
    expect(wouldCreateCycle([], 'a', 'a')).toBe(true);
  });

  it("rejects setting a parent to one of the element's own descendants", () => {
    // a -> b -> c (c's parent is b, b's parent is a)
    const elements = [
      { id: 'a', parentId: undefined },
      { id: 'b', parentId: 'a' },
      { id: 'c', parentId: 'b' },
    ];
    // Trying to make 'a' a child of 'c' (its own grandchild) would create a cycle.
    expect(wouldCreateCycle(elements, 'a', 'c')).toBe(true);
  });

  it('allows a normal, non-cyclic parent assignment', () => {
    const elements = [
      { id: 'a', parentId: undefined },
      { id: 'b', parentId: undefined },
    ];
    expect(wouldCreateCycle(elements, 'b', 'a')).toBe(false);
  });

  it('allows re-parenting to an unrelated existing subtree', () => {
    const elements = [
      { id: 'a', parentId: undefined },
      { id: 'b', parentId: 'a' },
      { id: 'x', parentId: undefined },
    ];
    expect(wouldCreateCycle(elements, 'b', 'x')).toBe(false);
  });

  it('does not infinite-loop on pre-existing unrelated cycles in the data', () => {
    const elements = [
      { id: 'p', parentId: 'q' },
      { id: 'q', parentId: 'p' },
    ];
    expect(wouldCreateCycle(elements, 'z', 'p')).toBe(false);
  });
});
