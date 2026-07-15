/**
 * 🧪 Unit Tests for KDS Processing Helpers
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Run with: npm test -- --testPathPattern=kdsProcessingHelpers
 * 
 * @jest-environment node
 */

import {
    extractString,
    parseModifiers,
    getModifierColor,
    buildStructuredModifiers,
    shouldIncludeItem,
    groupItemsByStatus,
    determineCardStatus,
    hasActiveItems,
    getSmartId
} from '@/pages/kds/hooks/kdsProcessingHelpers';

describe('extractString', () => {
    it('returns empty string for null/undefined', () => {
        expect(extractString(null)).toBe('');
        expect(extractString(undefined)).toBe('');
    });

    it('returns string as-is', () => {
        expect(extractString('קפה הפוך')).toBe('קפה הפוך');
    });

    it('extracts Hebrew name from object', () => {
        expect(extractString({ he: 'קפה', en: 'Coffee' })).toBe('קפה');
    });

    it('extracts name property from object', () => {
        expect(extractString({ name: 'לאטה' })).toBe('לאטה');
    });

    it('falls back to JSON.stringify for unknown objects', () => {
        const result = extractString({ foo: 'bar' });
        expect(result).toContain('foo');
    });
});

describe('parseModifiers', () => {
    it('returns empty array for null/undefined', () => {
        expect(parseModifiers(null)).toEqual([]);
        expect(parseModifiers(undefined)).toEqual([]);
    });

    it('parses JSON string array', () => {
        expect(parseModifiers('["סויה", "חם"]')).toEqual(['סויה', 'חם']);
    });

    it('handles already-parsed array', () => {
        expect(parseModifiers(['סויה', 'חם'])).toEqual(['סויה', 'חם']);
    });

    it('handles malformed JSON gracefully', () => {
        expect(parseModifiers('not json')).toEqual(['not json']);
    });

    it('extracts strings from objects in array', () => {
        const mods = [{ he: 'סויה' }, { name: 'קר' }];
        expect(parseModifiers(mods)).toEqual(['סויה', 'קר']);
    });
});

describe('getModifierColor', () => {
    it('returns lightgreen for סויה', () => {
        expect(getModifierColor('חלב סויה')).toBe('mod-color-lightgreen');
    });

    it('returns blue for נטול', () => {
        expect(getModifierColor('נטול קפאין')).toBe('mod-color-blue');
    });

    it('returns red for רותח', () => {
        expect(getModifierColor('חלב רותח')).toBe('mod-color-red');
    });

    it('returns gray for unknown', () => {
        expect(getModifierColor('משהו אחר')).toBe('mod-color-gray');
    });
});

describe('groupItemsByStatus', () => {
    const items = [
        { id: '1', item_status: 'in_progress' },
        { id: '2', item_status: 'ready' },
        { id: '3', item_status: 'held' },
        { id: '4', item_status: 'new' },
        { id: '5', item_status: 'completed' },
    ];

    it('groups items correctly', () => {
        const result = groupItemsByStatus(items);

        expect(result.active).toHaveLength(1);
        expect(result.active[0].id).toBe('1');

        expect(result.ready).toHaveLength(2);
        expect(result.ready.map(i => i.id)).toContain('2');
        expect(result.ready.map(i => i.id)).toContain('5');

        expect(result.delayed).toHaveLength(1);
        expect(result.delayed[0].id).toBe('3');

        expect(result.new).toHaveLength(1);
        expect(result.new[0].id).toBe('4');
    });

    it('returns empty object for empty array', () => {
        expect(groupItemsByStatus([])).toEqual({});
    });
});

describe('determineCardStatus', () => {
    const order = { order_status: 'in_progress' };
    const items = [{ item_status: 'in_progress' }];

    it('returns new status for new group', () => {
        const result = determineCardStatus('new', items, order);
        expect(result.cardType).toBe('active');
        expect(result.cardStatus).toBe('new');
    });

    it('returns delayed status for delayed group', () => {
        const result = determineCardStatus('delayed', items, order);
        expect(result.cardType).toBe('delayed');
        expect(result.cardStatus).toBe('pending');
    });

    it('returns ready status for ready group', () => {
        const result = determineCardStatus('ready', items, order);
        expect(result.cardType).toBe('ready');
        expect(result.cardStatus).toBe('ready');
    });

    it('returns in_progress for active group', () => {
        const result = determineCardStatus('active', items, order);
        expect(result.cardType).toBe('active');
        expect(result.cardStatus).toBe('in_progress');
    });
});

describe('hasActiveItems', () => {
    it('returns true for items with in_progress', () => {
        const items = [{ item_status: 'in_progress' }];
        expect(hasActiveItems(items)).toBe(true);
    });

    it('returns true for items with held', () => {
        const items = [{ item_status: 'held' }];
        expect(hasActiveItems(items)).toBe(true);
    });

    it('returns false for completed only', () => {
        const items = [{ item_status: 'completed' }];
        expect(hasActiveItems(items)).toBe(false);
    });

    it('returns false for cancelled only', () => {
        const items = [{ item_status: 'cancelled' }];
        expect(hasActiveItems(items)).toBe(false);
    });
});

describe('getSmartId', () => {
    it('returns null for null/undefined', () => {
        expect(getSmartId(null)).toBe(null);
        expect(getSmartId(undefined)).toBe(undefined);
    });

    it('preserves UUIDs', () => {
        const uuid = '6c06ef26-ae19-4b2a-9fb7-42d738428f8e';
        expect(getSmartId(uuid)).toBe(uuid);
    });

    it('strips -ready suffix', () => {
        const id = '6c06ef26-ae19-4b2a-9fb7-42d738428f8e-ready';
        expect(getSmartId(id)).toBe('6c06ef26-ae19-4b2a-9fb7-42d738428f8e');
    });

    it('strips -delayed suffix', () => {
        const id = '6c06ef26-ae19-4b2a-9fb7-42d738428f8e-delayed';
        expect(getSmartId(id)).toBe('6c06ef26-ae19-4b2a-9fb7-42d738428f8e');
    });

    it('preserves local IDs starting with L', () => {
        expect(getSmartId('L12345')).toBe('L12345');
    });

    it('parses numeric strings', () => {
        expect(getSmartId('12345')).toBe(12345);
    });
});

describe('shouldIncludeItem', () => {
    it('excludes cancelled items', () => {
        expect(shouldIncludeItem({ item_status: 'cancelled' })).toBe(false);
    });

    it('includes in_progress items', () => {
        expect(shouldIncludeItem({ item_status: 'in_progress' })).toBe(true);
    });

    it('excludes GRAB_AND_GO without override', () => {
        const item = {
            item_status: 'in_progress',
            menu_items: { kds_routing_logic: 'GRAB_AND_GO' },
            mods: null
        };
        expect(shouldIncludeItem(item)).toBe(false);
    });

    it('includes GRAB_AND_GO with __KDS_OVERRIDE__', () => {
        const item = {
            item_status: 'in_progress',
            menu_items: { kds_routing_logic: 'GRAB_AND_GO' },
            mods: '["__KDS_OVERRIDE__"]'
        };
        expect(shouldIncludeItem(item)).toBe(true);
    });
});
