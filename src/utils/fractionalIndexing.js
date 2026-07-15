/**
 * Fractional Indexing Utilities
 * Provides O(1) reordering by using floating point positions.
 */

/**
 * Calculates a new position based on neighbors.
 * @param {number|null} prevPos - Position of the item before.
 * @param {number|null} nextPos - Position of the item after.
 * @returns {number} The new calculated position.
 */
export const calculateNewPosition = (prevPos, nextPos) => {
    // 1. If queue is empty
    if (prevPos === null && nextPos === null) {
        return 1.0;
    }

    // 2. If adding to the end
    if (nextPos === null) {
        return (prevPos || 0) + 1.0;
    }

    // 3. If adding to the beginning
    if (prevPos === null) {
        return (nextPos || 2.0) / 2.0;
    }

    // 4. If inserting between two tracks
    return (prevPos + nextPos) / 2;
};
