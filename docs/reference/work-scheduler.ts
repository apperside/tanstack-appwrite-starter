import * as fs from 'fs';

type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

type TimeSlot = [number, number]; // [start hour, end hour]

type PersonAvailability = {
  [key in DayOfWeek]?: TimeSlot[];
};

type PeopleAvailability = {
  [userId: number]: PersonAvailability;
};

export type JobItem = {
  projectItemId: string;
  assignees: string[];
  startDateTime: string;
  finishDateTime: string;
  percentageDone: number;
  ownerUserId: string[];
};

interface Task {
  id: string;
  subject: string;
  type: string;
  work: number;
  totalWork: number;
  remainingWork: number;
  totalRemainingWork: number;
  status: string;
  assignee: string;
  priority: string;
  dueDate: string | null;
  project: string;
  parent: string | null;
  children: Task[];
  effectiveDueDate: Date | null;
}

const peopleAvailability: PeopleAvailability = {
  4: {
    mon: [
      [6, 10],
      [18, 19],
    ],
    tue: [
      [6, 10],
      [18, 19],
    ],
    wed: [
      [6, 10],
      [18, 19],
    ],
    thu: [
      [6, 10],
      [18, 19],
    ],
    fri: [
      [6, 10],
      [18, 19],
    ],
    sat: [[6, 11]],
  },
  5: {
    mon: [
      [6, 10],
      [18, 19],
    ],
    tue: [
      [6, 10],
      [18, 19],
    ],
    thu: [
      [6, 10],
      [18, 19],
    ],
    fri: [
      [6, 10],
      [18, 19],
    ],
    sat: [[6, 11]],
  },
};

function parseCsv(filePath: string): Task[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  // Skip header
  const dataLines = lines.slice(1);
  
  const tasks: Task[] = [];
  
  for (const line of dataLines) {
    // Parse CSV line (simple parser, assumes no commas in values except in quotes)
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());
    
    if (values.length < 12) continue;
    
    const task: Task = {
      id: values[0].replace(/^\uFEFF/, ''), // Remove BOM if present
      subject: values[1],
      type: values[2],
      work: parseFloat(values[3]) || 0,
      totalWork: parseFloat(values[4]) || 0,
      remainingWork: parseFloat(values[5]) || 0,
      totalRemainingWork: parseFloat(values[6]) || 0,
      status: values[7],
      assignee: values[8],
      priority: values[9],
      dueDate: values[10] || null,
      project: values[11],
      parent: values[12] || null,
      children: [],
      effectiveDueDate: null,
    };
    
    tasks.push(task);
  }
  
  return tasks;
}

// Extract parent ID from parent string (e.g., "Epic #39: MVP" -> "39")
function getParentId(task: Task): string | null {
  return task.parent?.match(/#(\d+)/)?.[1] ?? null;
}

function buildHierarchy(tasks: Task[]): Task[] {
  const taskMap = new Map<string, Task>();
  
  // Create a map of all tasks
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }
  
  // Build parent-child relationships
  const rootTasks: Task[] = [];
  
  for (const task of tasks) {
    const parentId = getParentId(task);
    const parent = parentId ? taskMap.get(parentId) : undefined;
    if (parent) {
      parent.children.push(task);
    } else {
      rootTasks.push(task);
    }
  }
  
  return rootTasks;
}

function calculateEffectiveDueDates(task: Task, parentDueDate: Date | null = null): void {
  // Get today's date at start of day for comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Parse task's own due date
  let taskDueDate: Date | null = null;
  if (task.dueDate) {
    const parts = task.dueDate.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0]) - 1; // JS months are 0-indexed
      const day = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      taskDueDate = new Date(year, month, day, 23, 59, 59);
      
      // If due date is in the past, treat it as today
      if (taskDueDate < today) {
        console.warn(
          `⚠️  Task #${task.id} "${task.subject}" has past due date ${task.dueDate}. ` +
          `Treating as due TODAY (${today.toLocaleDateString('en-US')}).`
        );
        taskDueDate = new Date(today);
        taskDueDate.setHours(23, 59, 59, 999);
      }
    }
  }
  
  // Validation: if this is a leaf task with its own due date, 
  // it must be <= parent's due date
  const isLeafTask = task.children.length === 0 && task.remainingWork > 0;
  if (isLeafTask && taskDueDate && parentDueDate && taskDueDate > parentDueDate) {
    console.error(
      `❌ ERROR: Task #${task.id} "${task.subject}" has due date ${task.dueDate} ` +
      `which is AFTER its parent's due date ${parentDueDate.toLocaleDateString('en-US')}. ` +
      `This is not allowed. Please fix the due date in OpenProject.`
    );
    // Set effective due date to parent's date (more restrictive)
    task.effectiveDueDate = parentDueDate;
  } else if (taskDueDate && parentDueDate) {
    // Use the more restrictive date (earlier)
    task.effectiveDueDate = taskDueDate < parentDueDate ? taskDueDate : parentDueDate;
  } else if (taskDueDate) {
    task.effectiveDueDate = taskDueDate;
  } else if (parentDueDate) {
    // Check if parent's due date is in the past
    if (parentDueDate < today) {
      const adjustedDate = new Date(today);
      adjustedDate.setHours(23, 59, 59, 999);
      task.effectiveDueDate = adjustedDate;
    } else {
      // Leaf task inherits parent's due date
      task.effectiveDueDate = parentDueDate;
    }
  }
  
  // Recursively process children
  for (const child of task.children) {
    calculateEffectiveDueDates(child, task.effectiveDueDate);
  }
}

function getLeafTasks(task: Task, leafTasks: Task[] = []): Task[] {
  if (task.children.length === 0 && task.remainingWork > 0) {
    leafTasks.push(task);
  } else {
    for (const child of task.children) {
      getLeafTasks(child, leafTasks);
    }
  }
  return leafTasks;
}

function getAllLeafTasks(rootTasks: Task[]): Task[] {
  const allLeafTasks: Task[] = [];
  for (const task of rootTasks) {
    getLeafTasks(task, allLeafTasks);
  }
  return allLeafTasks;
}

function sortTasks(tasks: Task[]): Task[] {
  return tasks.sort((a, b) => {
    // First by due date (tasks with due dates come first, earlier dates first)
    if (a.effectiveDueDate && b.effectiveDueDate) {
      const dateDiff = a.effectiveDueDate.getTime() - b.effectiveDueDate.getTime();
      if (dateDiff !== 0) return dateDiff;
    } else if (a.effectiveDueDate) {
      return -1;
    } else if (b.effectiveDueDate) {
      return 1;
    }
    
    // Then by priority (High before Normal)
    const priorityOrder: Record<string, number> = { 'High': 0, 'Normal': 1, '': 2 };
    const priorityDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    if (priorityDiff !== 0) return priorityDiff;
    
    // Finally by task ID
    return parseInt(a.id) - parseInt(b.id);
  });
}

function getDayOfWeek(date: Date): DayOfWeek {
  const days: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return days[date.getDay()];
}

function getAvailableHours(userId: number, date: Date): TimeSlot[] {
  const day = getDayOfWeek(date);
  const availability = peopleAvailability[userId];
  return availability[day] || [];
}

function getTotalAvailableHours(userId: number, date: Date): number {
  const slots = getAvailableHours(userId, date);
  return slots.reduce((total, [start, end]) => total + (end - start), 0);
}

const HOUR_MS = 60 * 60 * 1000;

// The earliest free time window at or after `from`, searching up to `maxLookaheadDays` ahead
function findNextSlot(userId: number, from: Date, maxLookaheadDays: number): [Date, Date] | null {
  const day = new Date(from);
  for (let i = 0; i < maxLookaheadDays; i++) {
    for (const [startHour, endHour] of getAvailableHours(userId, day)) {
      const slotStart = new Date(day);
      slotStart.setHours(startHour, 0, 0, 0);
      const slotEnd = new Date(day);
      slotEnd.setHours(endHour, 0, 0, 0);
      if (slotEnd > from) {
        return [slotStart > from ? slotStart : new Date(from), slotEnd];
      }
    }
    day.setDate(day.getDate() + 1);
    day.setHours(0, 0, 0, 0);
  }
  return null;
}

function scheduleTask(
  task: Task,
  userSchedules: Map<number, Date>,
  maxLookaheadDays: number = 365
): JobItem[] {
  const result: JobItem[] = [];
  const userIds = [4, 5]; // Available users
  
  // Give the whole task to the user who can start it the earliest;
  // each schedule is that user's next free moment
  let userId: number | null = null;
  let slot: [Date, Date] | null = null;
  for (const id of userIds) {
    const candidate = findNextSlot(id, userSchedules.get(id)!, maxLookaheadDays);
    if (candidate && (!slot || candidate[0] < slot[0])) {
      userId = id;
      slot = candidate;
    }
  }
  
  if (userId === null || !slot) return result;
  
  if (task.effectiveDueDate && slot[0] > task.effectiveDueDate) {
    console.warn(`Warning: Task ${task.id} "${task.subject}" cannot be completed by due date ${task.effectiveDueDate.toLocaleDateString()}`);
  }
  
  let remainingWork = task.remainingWork;
  
  while (remainingWork > 0 && slot) {
    const [startDateTime, slotEnd] = slot;
    const workInSlot = Math.min(remainingWork, (slotEnd.getTime() - startDateTime.getTime()) / HOUR_MS);
    const finishDateTime = new Date(startDateTime.getTime() + workInSlot * HOUR_MS);
    
    result.push({
      projectItemId: task.id,
      assignees: [userId.toString()],
      startDateTime: startDateTime.toISOString(),
      finishDateTime: finishDateTime.toISOString(),
      percentageDone: 0,
      ownerUserId: [userId.toString()],
    });
    
    remainingWork -= workInSlot;
    userSchedules.set(userId, finishDateTime);
    slot = remainingWork > 0 ? findNextSlot(userId, finishDateTime, maxLookaheadDays) : null;
  }
  
  return result;
}

function createWorkPlan(tasks: Task[]): JobItem[] {
  const workPlan: JobItem[] = [];
  const userSchedules = new Map<number, Date>();
  
  // Start scheduling from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Initialize user schedules
  userSchedules.set(4, new Date(today));
  userSchedules.set(5, new Date(today));
  
  for (const task of tasks) {
    const jobItems = scheduleTask(task, userSchedules);
    workPlan.push(...jobItems);
  }
  
  return workPlan;
}

function main() {
  const csvPath = '/Users/simone/dev/tanstack/my-tanstack-app.worktrees/tasker/docs/tasks/2026-10-28-foundations.csv';
  
  console.log('Parsing CSV...');
  const tasks = parseCsv(csvPath);
  console.log(`Loaded ${tasks.length} tasks`);
  
  console.log('\nBuilding task hierarchy...');
  const rootTasks = buildHierarchy(tasks);
  
  console.log('\nCalculating effective due dates...');
  for (const task of rootTasks) {
    calculateEffectiveDueDates(task);
  }
  
  console.log('\nExtracting leaf tasks...');
  const leafTasks = getAllLeafTasks(rootTasks);
  console.log(`Found ${leafTasks.length} leaf tasks`);
  
  console.log('\nSorting tasks by due date and priority...');
  const sortedTasks = sortTasks(leafTasks);
  
  console.log('\nCreating work plan...');
  const workPlan = createWorkPlan(sortedTasks);
  
  console.log(`\nGenerated ${workPlan.length} work assignments`);
  
  // Save to file
  const outputPath = '/Users/simone/dev/tanstack/my-tanstack-app.worktrees/tasker/docs/tasks/work-plan.json';
  fs.writeFileSync(outputPath, JSON.stringify(workPlan, null, 2));
  console.log(`\nWork plan saved to: ${outputPath}`);
  
  // Create a summary
  const summary = workPlan.reduce((acc, item) => {
    const date = new Date(item.startDateTime).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(item);
    return acc;
  }, {} as Record<string, JobItem[]>);
  
  console.log('\n=== WORK PLAN SUMMARY ===\n');
  Object.keys(summary).sort().forEach(date => {
    console.log(`${date}:`);
    summary[date].forEach(item => {
      const task = tasks.find(t => t.id === item.projectItemId);
      const start = new Date(item.startDateTime);
      const finish = new Date(item.finishDateTime);
      const duration = (finish.getTime() - start.getTime()) / (1000 * 60 * 60);
      console.log(`  ${start.toLocaleTimeString()} - ${finish.toLocaleTimeString()} (${duration}h) - User ${item.ownerUserId[0]} - ${task?.subject || 'Unknown'}`);
    });
    console.log('');
  });
  
  // Also save a human-readable version
  const readablePath = '/Users/simone/dev/tanstack/my-tanstack-app.worktrees/tasker/docs/tasks/work-plan-summary.txt';
  const readableContent = Object.keys(summary).sort().map(date => {
    const items = summary[date].map(item => {
      const task = tasks.find(t => t.id === item.projectItemId);
      const start = new Date(item.startDateTime);
      const finish = new Date(item.finishDateTime);
      const duration = (finish.getTime() - start.getTime()) / (1000 * 60 * 60);
      return `  ${start.toLocaleTimeString()} - ${finish.toLocaleTimeString()} (${duration}h) - User ${item.ownerUserId[0]} - ${task?.subject || 'Unknown'}`;
    }).join('\n');
    return `${date}:\n${items}\n`;
  }).join('\n');
  
  fs.writeFileSync(readablePath, readableContent);
  console.log(`Summary saved to: ${readablePath}`);

  // Data for gantt-chart.html, as a script so it loads from file:// without a server
  const taskData = Object.fromEntries(
    tasks.map(t => [t.id, { Subject: t.subject, Type: t.type, Project: t.project, Priority: t.priority, ParentId: getParentId(t) }])
  );
  const ganttDataPath = '/Users/simone/dev/tanstack/my-tanstack-app.worktrees/tasker/docs/tasks/gantt-data.js';
  fs.writeFileSync(ganttDataPath, `window.ganttData = ${JSON.stringify({ workPlan, taskData }, null, 2)};\n`);
  console.log(`Gantt data saved to: ${ganttDataPath}`);
}

main();
