

# Fix question_number mapping collision

## Root Cause

The Excel file contains three columns that ALL map to `question_number` in the COLUMN_MAP:

| Excel Column | Example Value | Numeric? |
|---|---|---|
| question_number | 1, 2, 3... | Yes |
| question_id | Q1, Q2, Q3... | No |
| question_number_in_book | n1-m1-1 | No |

When the mapping loop runs, the last column processed overwrites the earlier ones. So `question_number_in_book` (value: "n1-m1-1") overwrites the real `question_number` (value: 1), and parseInt("n1-m1-1") returns NaN, resulting in null/"خطأ".

## Fix (single file: `src/pages/system/ImportTextQuestions.tsx`)

### 1. Remove conflicting mappings from COLUMN_MAP (lines 77-79)

Remove these three lines that were added in the last edit:
- `"question id": "question_number"` -- these are IDs like Q1, not numbers
- `"رقم": "question_number"` -- too generic, could collide
- `"question number in book": "question_number"` -- contains non-numeric codes

Keep only `"question number": "question_number"` (line 76) and `"رقم السوال": "question_number"` (line 56).

### 2. Update parsing to prefer first valid numeric value (lines 214-219)

Instead of relying on a single mapped field, scan ALL columns that could contain a question number and use the first valid integer found:

```
question_number: (() => {
  // Try the mapped value first
  const raw = mapped.question_number;
  if (raw !== undefined && raw !== null) {
    const parsed = parseInt(String(raw), 10);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
})(),
```

This is already correct -- the real fix is just removing the conflicting mappings so the correct column value isn't overwritten.

## Summary

- Remove 3 lines from COLUMN_MAP (lines 77-79)
- The existing parsing logic at lines 214-219 is already correct and needs no change
- Result: question_number column (with values 1, 2, 3...) will be correctly mapped without being overwritten

