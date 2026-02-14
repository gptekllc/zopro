

## Restructure Job Form Layout: Priority/Status Row, Duration Options, and Remove Scheduled End

### Changes (all in `src/pages/Jobs.tsx`)

**1. Priority and Status on the same row (including mobile)**

Currently these are in a `grid-cols-1 sm:grid-cols-3` grid (lines 691-736), meaning they stack on mobile. Change the first row to always show Priority and Status side-by-side using `grid-cols-2`, and move Est. Duration out of this row.

**2. Add 15-minute option to Est. Duration**

Add `<SelectItem value="15">15 min</SelectItem>` as the first option in the duration dropdown (before the existing "30 min" option).

**3. Est. Duration and Scheduled Start on the same row**

Create a new `grid-cols-2` row containing Est. Duration and Scheduled Start, so they sit side-by-side on all screen sizes.

**4. Remove Scheduled End field**

Remove the Scheduled End input entirely from the form. The `scheduled_end` field in `formData` can remain in state (defaulting to empty string) so existing data is not broken, but the UI field is removed.

**5. Labor Rate stays on its own row or joins another row**

Labor Rate will move to its own single-field row beneath the Duration/Scheduled Start row.

### Layout Summary

```text
Row 1: [ Priority (1/2) ] [ Status (1/2) ]
Row 2: [ Est. Duration (1/2) ] [ Scheduled Start (1/2) ]
Row 3: [ Labor Rate ($/hr) ]
```

### Technical Details

**Lines 691-760** will be restructured as follows:

Row 1 (Priority + Status) -- always 2 columns:
```tsx
<div className="grid grid-cols-2 gap-4">
  <div className="space-y-2">
    <Label>Priority</Label>
    <Select ...>{/* unchanged */}</Select>
  </div>
  <div className="space-y-2">
    <Label>Status</Label>
    <Select ...>{/* unchanged */}</Select>
  </div>
</div>
```

Row 2 (Est. Duration + Scheduled Start) -- always 2 columns:
```tsx
<div className="grid grid-cols-2 gap-4">
  <div className="space-y-2">
    <Label>Est. Duration</Label>
    <Select ...>
      <SelectContent>
        <SelectItem value="15">15 min</SelectItem>  {/* NEW */}
        <SelectItem value="30">30 min</SelectItem>
        {/* ...rest unchanged */}
      </SelectContent>
    </Select>
  </div>
  <div className="space-y-2">
    <Label>Scheduled Start</Label>
    <Input type="datetime-local" ... />
  </div>
</div>
```

Row 3 (Labor Rate alone):
```tsx
<div className="grid grid-cols-2 gap-4">
  <div className="space-y-2">
    <Label>Labor Rate ($/hr)</Label>
    <Input type="number" ... />
  </div>
</div>
```

The Scheduled End field (lines 746-752) will be removed entirely.

