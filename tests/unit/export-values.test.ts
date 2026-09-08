import {expect,test} from 'vitest';
import {exportValue} from '../../src/lib/export-values';
import {dateTime} from '../../src/lib/domain';
test('download uses AZN, preserves missing versus zero and never rescales quantity',()=>{expect(exportValue({amount:100001,quantity:3,commercial:{total:null},opening_amount:0})).toEqual({amount:1000.01,quantity:3,commercial:{total:null},opening_amount:0});});
test('Baku date display crosses UTC midnight without unsupported month names',()=>{expect(dateTime('2026-09-07T21:30:00Z')).toBe('08.09.2026 01:30');});
