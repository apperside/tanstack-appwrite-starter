# Work Scheduling System - Complete Documentation for Claude Code

## Table of Contents
1. [Project Overview](#project-overview)
2. [What We Built](#what-we-built)
3. [Business Rules](#business-rules)
4. [Technical Architecture](#technical-architecture)
5. [Code Structure](#code-structure)
6. [Current Issues](#current-issues)
7. [Next Steps](#next-steps)
8. [Testing & Validation](#testing--validation)

---

## Project Overview

### Purpose
Intelligent work scheduling system that converts OpenProject CSV exports into optimized day-to-day work plans.

### User Context
- **Name**: Apperside
- **Role**: Indie hacker, 15 years programming experience
- **Location**: Milan, Italy (Europe/Rome timezone - UTC+1/+2)
- **Working Hours**: ~5 hours/day (early morning 6-10am + evening 6-7pm)
- **Projects**: Polybank (main), Reperio, Personal tasks, Shopping
- **Need**: Realistic, achievable work plan across multiple projects

### Key Constraints
- Limited daily availability (split morning/evening)
- Multiple projects competing for time
- Some tasks already overdue (capacity issues)
- User 5 has no availability on Wednesdays

---

## What We Built

### Input
OpenProject CSV export containing:
- 56 tasks across 6 projects
- Hierarchical structure (Epics → Features → Tasks)
- Due dates, priorities, work estimates
- Assignee information

### Processing
1. Parse CSV (handles any row order)
2. Build parent-child hierarchy
3. Calculate effective due dates (with inheritance)
4. Extract leaf tasks (only actionable items)
5. Sort by: due date → priority → task ID
6. Schedule work based on people availability
7. Generate multiple output formats

### Output
- **work-plan.json** - 43 JobItem objects (machine-readable)
- **work-plan-summary.txt** - Daily schedule (human-readable)
- **gantt-chart.html** - Interactive visualization with filters
- **work-scheduler.ts** - TypeScript source code

### Results
- 27 working days scheduled (Nov 22 - Dec 18, 2025)
- 43 work assignments created
- ~52 hours for User 4, ~46 hours for User 5
- 2 overdue tasks identified and prioritized

---

## Business Rules

### Rule 1: Past Due Dates → Due Today ✅
**Any incomplete task with a past due date is automatically adjusted to today's date.**

**Rationale**: Can't complete work in the past; overdue tasks become highest priority.

**Implementation**: `work-scheduler.ts`, lines 193-200
```typescript
if (isLeafTask && taskDueDate && taskDueDate < today) {
  console.warn(`⚠️ Task #${task.id} has past due date. Treating as due TODAY.`);
  taskDueDate = new Date(today);
}
```

**Example from current schedule**:
```
Task #51 "Andare alla renault" - due 11/20/2025 → adjusted to 11/23/2025 (TODAY)
Task #112 "Calzolaio" - due 11/20/2025 → adjusted to 11/23/2025 (TODAY)
```

### Rule 2: Leaf Tasks ≤ Parent Due Date ✅
**Leaf tasks with explicit due dates MUST have dates ≤ parent's due date.**

**Rationale**: Child work must complete before/when parent completes; prevents logical inconsistencies.

**Implementation**: `work-scheduler.ts`, lines 207-214
```typescript
if (isLeafTask && taskDueDate && parentDueDate && taskDueDate > parentDueDate) {
  console.error(`❌ ERROR: Task #${task.id} has due date AFTER parent's due date.`);
  task.effectiveDueDate = parentDueDate; // Use safer date
}
```

**Validation status**: ✅ No violations in current data

**Examples**:
- ✅ Parent: 11/30, Child: 11/25 (OK - earlier)
- ✅ Parent: 11/30, Child: no date (OK - inherits)
- ✅ Parent: 11/30, Child: 11/30 (OK - equal)
- ❌ Parent: 11/30, Child: 12/05 (ERROR - later)

### Rule 3: Input Can Be Unsorted ✅
**CSV input can have tasks in any order - internal sorting handles it.**

**Sorting criteria**:
1. Due date (earliest first, tasks with dates before those without)
2. Priority (High before Normal)
3. Task ID (ascending)

**Implementation**: `work-scheduler.ts`, function `sortTasks()`, lines 257-277

---

## Technical Architecture

### Data Structures

```typescript
interface Task {
  id: string;                    // OpenProject task ID
  subject: string;               // Task name
  type: string;                  // Epic, Feature, Task, Bug
  work: number;                  // Assigned work hours
  remainingWork: number;         // Hours left to complete
  status: string;                // New, In Progress, etc.
  assignee: string;              // Assigned user
  priority: string;              // High, Normal, ""
  dueDate: string | null;        // Original due date (MM/DD/YYYY)
  project: string;               // Project name
  parent: string | null;         // Parent reference (e.g., "Epic #39: MVP")
  children: Task[];              // Child tasks
  effectiveDueDate: Date | null; // Computed deadline (considers parent & past dates)
}

type JobItem = {
  projectItemId: string;      // Task ID reference
  assignees: string[];        // User IDs assigned
  startDateTime: string;      // ISO 8601 timestamp (UTC)
  finishDateTime: string;     // ISO 8601 timestamp (UTC)
  percentageDone: number;     // Progress (0-100)
  ownerUserId: string[];      // Primary owner
};
```

### People Availability

```typescript
const peopleAvailability = {
  4: {  // User 4
    mon: [[6, 10], [18, 19]],  // 6-10am, 6-7pm
    tue: [[6, 10], [18, 19]],
    wed: [[6, 10], [18, 19]],
    thu: [[6, 10], [18, 19]],
    fri: [[6, 10], [18, 19]],
    sat: [[6, 11]],            // 6-11am only
  },
  5: {  // User 5 - NO WEDNESDAY
    mon: [[6, 10], [18, 19]],
    tue: [[6, 10], [18, 19]],
    // NO WED
    thu: [[6, 10], [18, 19]],
    fri: [[6, 10], [18, 19]],
    sat: [[6, 11]],
  }
};
```

### Processing Pipeline

```
┌────────────────┐
│ 1. parseCsv()  │  Parse CSV → Task[] (any order OK)
└───────┬────────┘
        │
┌───────▼────────┐
│ 2. buildHier() │  Create parent-child relationships
└───────┬────────┘
        │
┌───────▼────────────────┐
│ 3. calcDueDates()      │  Apply business rules (past dates, inheritance)
└───────┬────────────────┘
        │
┌───────▼────────────────┐
│ 4. getLeafTasks()      │  Extract only actionable tasks (no children)
└───────┬────────────────┘
        │
┌───────▼────────────────┐
│ 5. sortTasks()         │  Sort by due date → priority → ID
└───────┬────────────────┘
        │
┌───────▼────────────────┐
│ 6. createWorkPlan()    │  Allocate to users based on availability
└───────┬────────────────┘
        │
┌───────▼────────────────┐
│ 7. Output files        │  JSON, TXT, HTML
└────────────────────────┘
```

---

## Code Structure

### Main File: `work-scheduler.ts` (467 lines)

**Key Functions**:

```typescript
// Line ~90: Parse CSV into Task objects
parseCsv(filePath: string): Task[]

// Line ~142: Build parent-child hierarchy from flat list
buildHierarchy(tasks: Task[]): Task[]

// Line ~177: Calculate effective due dates with business rules
calculateEffectiveDueDates(task: Task, parentDueDate: Date | null): void
  // Handles: past dates → today
  // Validates: leaf ≤ parent
  // Applies recursively to all children

// Line ~238: Extract only leaf tasks (no children, has remaining work)
getLeafTasks(task: Task, leafTasks: Task[]): Task[]

// Line ~247: Get all leaf tasks from root tasks
getAllLeafTasks(rootTasks: Task[]): Task[]

// Line ~257: Sort tasks by criteria
sortTasks(tasks: Task[]): Task[]
  // 1st: Due date (earliest first)
  // 2nd: Priority (High before Normal)
  // 3rd: Task ID (ascending)

// Line ~279: Get day of week from date
getDayOfWeek(date: Date): DayOfWeek

// Line ~284: Get availability slots for user on date
getAvailableHours(userId: number, date: Date): TimeSlot[]

// Line ~289: Calculate total hours available
getTotalAvailableHours(userId: number, date: Date): number

// Line ~294: Schedule a single task across days/slots
scheduleTask(
  task: Task, 
  currentDate: Date, 
  userSchedules: Map<number, Date>
): JobItem[]
  // Finds earliest available user
  // Allocates work to time slots
  // Splits large tasks across days
  // Returns array of JobItems

// Line ~367: Orchestrate entire scheduling process
createWorkPlan(tasks: Task[]): JobItem[]

// Line ~394: Main entry point
main()
```

**Critical Code Locations**:

| Feature | Function | Lines |
|---------|----------|-------|
| Past date handling | calculateEffectiveDueDates | 193-200 |
| Parent validation | calculateEffectiveDueDates | 207-214 |
| Inherited past dates | calculateEffectiveDueDates | 222-229 |
| Sorting logic | sortTasks | 257-277 |
| Availability config | peopleAvailability | 54-78 |
| Scheduling algorithm | scheduleTask | 294-363 |

### HTML Visualization: `gantt-chart.html` (self-contained)

**Features**:
- Interactive Gantt chart
- Filter by user (4 or 5)
- Filter by project (Polybank, Reperio, etc.)
- Hover tooltips with task details
- Color-coded by user (purple=User 4, pink=User 5)
- Statistics dashboard (total tasks, days, hours)

**Tech stack**: Vanilla JavaScript, no dependencies

---

## Current Issues

### High Priority

**1. Zero-Duration Display Bug**
- **Problem**: Tasks with 0.25h or 0.5h show as 0h (start=end time)
- **Example**: `6:00:00 AM - 6:00:00 AM (0h)`
- **Location**: `scheduleTask()` function, line ~315
- **Fix**: Add minimum duration enforcement
```typescript
const MIN_DURATION = 0.25; // 15 minutes
const workInSlot = Math.max(Math.min(remainingWork, slotDuration), MIN_DURATION);
```

**2. UTC Timestamps**
- **Problem**: All times in UTC, user is in Milan (UTC+1/+2)
- **Impact**: Times show in wrong timezone
- **Fix**: Use `luxon` or `date-fns-tz` for proper timezone handling
```typescript
import { DateTime } from 'luxon';
const milanTime = DateTime.fromISO(utcString, { zone: 'Europe/Rome' });
```

**3. Hardcoded Availability**
- **Problem**: User availability is hardcoded in source
- **Location**: Lines 54-78
- **Fix**: Move to external JSON config file
```json
{
  "users": {
    "4": { "name": "User 4", "availability": {...} },
    "5": { "name": "User 5", "availability": {...} }
  }
}
```

### Medium Priority

**4. No Task Dependencies**
- **Problem**: Can't specify "Task A must complete before Task B"
- **Current**: Only uses due dates and priorities
- **Fix**: Add `dependencies: string[]` to Task interface

**5. No Capacity Warnings**
- **Problem**: Doesn't warn if deadline is mathematically impossible
- **Current**: Schedules anyway, shows warning after
- **Fix**: Pre-calculate total required hours vs available hours

**6. No Calendar Export**
- **Problem**: Can't import into Google Calendar, Outlook, etc.
- **Fix**: Generate .ics files from JobItems

### Low Priority

**7. No Unit Tests**
**8. Limited Error Handling**
**9. Could Use Better TypeScript Types**
**10. Performance Not Optimized** (fine for <1000 tasks)

---

## Next Steps

### Immediate Fixes (Quick Wins)
1. Fix zero-duration rendering (add MIN_DURATION constant)
2. Add timezone support (install luxon, convert all dates)
3. Extract availability to config.json file

### Feature Enhancements
4. Add task dependencies support
5. Implement capacity validation (warn about impossible deadlines)
6. Export to .ics calendar format
7. Add command-line arguments for input/output paths

### Code Quality
8. Add unit tests (especially for business rules)
9. Better error handling (validate CSV structure)
10. Improve TypeScript types (stricter interfaces)

### Integration
11. Connect to OpenProject API (real-time sync)
12. Add notification/reminder system
13. Create web UI for interactive schedule editing

---

## Testing & Validation

### Current Test Data
- **File**: `/mnt/user-data/uploads/OpenProject_Work_packages_2025-11-2220251122-176-6qc1aw.csv`
- **Tasks**: 56 total, 38 leaf tasks
- **Date range**: Nov 20 - Dec 18, 2025
- **Projects**: Polybank, Reperio, Personal, Apperside, Shopping
- **Validation results**: 
  - ✅ No due date violations
  - ⚠️ 2 tasks with past due dates (correctly adjusted)

### How to Run

```bash
# Navigate to outputs directory
cd /mnt/user-data/outputs

# Install dependencies (if needed)
npm install

# Run scheduler
npx ts-node work-scheduler.ts

# View outputs
cat work-plan-summary.txt
open gantt-chart.html  # (copy to local machine first)
```

### Expected Output

```
Parsing CSV...
Loaded 56 tasks

Building task hierarchy...

Calculating effective due dates...
⚠️  Task #51 "Andare alla renault" has past due date 11/20/2025. Treating as due TODAY (11/23/2025).
⚠️  Task #112 "Calzolaio" has past due date 11/20/2025. Treating as due TODAY (11/23/2025).

Extracting leaf tasks...
Found 38 leaf tasks

Sorting tasks by due date and priority...

Creating work plan...
Warning: Task 43 "fix transation import" cannot be completed by due date 11/23/2025
Warning: Task 56 "Loader while entering as guest" cannot be completed by due date 11/23/2025
Warning: Task 57 "migrate ai logic to new google prompt" cannot be completed by due date 11/23/2025

Generated 43 work assignments

Work plan saved to: /mnt/user-data/outputs/work-plan.json
```

### Test Cases for Business Rules

**Test 1: Past due date**
```csv
id,Subject,Due Date,Remaining work
999,Test Task,11/01/2025,2.0
```
Expected: ⚠️ Warning + adjusted to today

**Test 2: Violates parent due date**
```csv
id,Subject,Due Date,Parent,Remaining work
1,Parent,11/30/2025,,0
2,Child,12/05/2025,"Epic #1: Parent",2.0
```
Expected: ❌ ERROR + uses parent's date

**Test 3: Unsorted input**
Shuffle CSV rows → Expected: Identical output (sorting is internal)

### Validation Checklist

When making changes:
- [ ] Run scheduler - does it complete without errors?
- [ ] Check work-plan.json - are all JobItems valid?
- [ ] Verify business rules - past dates adjusted? Validation working?
- [ ] Review schedule - tasks in correct priority order?
- [ ] Test Gantt chart - filters working? Tooltips accurate?
- [ ] Check capacity - no double-bookings? Time slots respected?

---

## File Locations

### Input
```
/mnt/user-data/uploads/OpenProject_Work_packages_*.csv
```

### Output
```
/mnt/user-data/outputs/
├── work-plan.json              # Machine-readable schedule (43 JobItems)
├── work-plan-summary.txt       # Human-readable daily breakdown
├── gantt-chart.html            # Interactive visualization
├── work-scheduler.ts           # Source code (467 lines)
└── CLAUDE_CODE_DOCS.md        # This file
```

### Dependencies
```json
{
  "typescript": "latest",
  "@types/node": "latest",
  "ts-node": "latest"
}
```

---

## Key Insights for Development

### What Works Well
✅ Hierarchical task parsing  
✅ Business rule validation  
✅ Flexible scheduling algorithm  
✅ Multiple output formats  
✅ Handles unsorted input  
✅ Interactive visualization  

### What Needs Improvement
⚠️ Zero-duration display  
⚠️ Timezone handling (UTC vs Milan)  
⚠️ Hardcoded configuration  
⚠️ No task dependencies  
⚠️ Limited error handling  
⚠️ No calendar export  

### Design Principles
- **Pragmatic over perfect**: Working code > architectural purity
- **Incremental improvements**: Don't break what works
- **User-focused**: Experienced developer, technical language OK
- **Tested before committed**: Always run scheduler after changes

### Communication Tips
- Be direct and technical
- Show code examples
- Suggest alternatives
- Ask clarifying questions
- Don't over-engineer

---

## Quick Reference

### Common Commands
```bash
# Re-run scheduler
npx ts-node work-scheduler.ts

# View schedule
cat work-plan-summary.txt

# Check for errors
npx ts-node work-scheduler.ts 2>&1 | grep -E "(ERROR|⚠️)"

# Count total hours scheduled
grep '"projectItemId"' work-plan.json | wc -l
```

### Important Constants
- Today: November 23, 2025
- User 4 ID: "4"
- User 5 ID: "5"
- Work hours per day: 5 hours (split AM/PM)
- Schedule horizon: ~27 days

### Quick Fixes
```typescript
// Fix zero-duration
const MIN_DURATION = 0.25;
const workInSlot = Math.max(duration, MIN_DURATION);

// Add timezone support
import { DateTime } from 'luxon';
const local = DateTime.fromISO(utc, { zone: 'Europe/Rome' });

// External config
const config = JSON.parse(fs.readFileSync('config.json'));
const peopleAvailability = config.users;
```

---

## Summary

**Project Status**: ✅ Working MVP with known improvement areas

**What's Working**:
- CSV parsing and hierarchy building
- Both business rules (past dates, validation)
- Scheduling algorithm with availability matching
- Multiple output formats (JSON, TXT, HTML)
- Interactive Gantt visualization

**What's Next**:
- Fix zero-duration display bug
- Add timezone support
- Extract configuration
- Implement task dependencies
- Add calendar export

**For Claude Code**: This is a functional system ready for incremental improvements. Start by understanding the code structure, then tackle high-priority issues. Ask questions about requirements before making assumptions.

---

**Last Updated**: November 23, 2025  
**Version**: 1.0  
**Lines of Code**: ~467 (TypeScript) + ~800 (HTML/JS)
