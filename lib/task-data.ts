export type Status = "Backlog" | "To Do" | "In Progress" | "Review" | "Done";
export type Priority = "Urgent" | "High" | "Normal" | "Low";

export type Task = {
  id: string;
  title: string;
  description: string;
  assignee: string;
  dueDate: string;
  priority: Priority;
  status: Status;
  project: string;
  tags: string[];
  estimate: number;
  createdAt: string;
};

export type TaskInput = Omit<Task, "id" | "createdAt"> & {
  id?: string;
  createdAt?: string;
};

export const statuses: Status[] = ["Backlog", "To Do", "In Progress", "Review", "Done"];
export const priorities: Priority[] = ["Urgent", "High", "Normal", "Low"];
export const defaultProjects = ["Website Redesign", "Mobile App", "Marketing Launch", "Operations"];

export const starterTasks: Task[] = [
  {
    id: "task-1",
    title: "Design onboarding task flow",
    description: "Map the first-use task creation experience and remove confusing choices.",
    assignee: "Ayesha Khan",
    dueDate: "2026-06-17",
    priority: "High",
    status: "In Progress",
    project: "Website Redesign",
    tags: ["UX", "Research"],
    estimate: 6,
    createdAt: "2026-06-09T10:00:00.000Z"
  },
  {
    id: "task-2",
    title: "Prepare release checklist",
    description: "Create launch checklist with ownership, due dates, rollback notes, and approval steps.",
    assignee: "Bilal Ahmed",
    dueDate: "2026-06-14",
    priority: "Urgent",
    status: "Review",
    project: "Mobile App",
    tags: ["Release"],
    estimate: 4,
    createdAt: "2026-06-08T12:30:00.000Z"
  },
  {
    id: "task-3",
    title: "Collect customer feedback themes",
    description: "Group recent comments into product, pricing, support, and onboarding themes.",
    assignee: "Mina Shah",
    dueDate: "2026-06-21",
    priority: "Normal",
    status: "To Do",
    project: "Marketing Launch",
    tags: ["Feedback", "Planning"],
    estimate: 3,
    createdAt: "2026-06-06T09:15:00.000Z"
  },
  {
    id: "task-4",
    title: "Automate weekly status report",
    description: "Generate team progress, overdue tasks, upcoming dates, and blocked items.",
    assignee: "Omar Raza",
    dueDate: "2026-06-26",
    priority: "Low",
    status: "Backlog",
    project: "Operations",
    tags: ["Automation"],
    estimate: 8,
    createdAt: "2026-06-05T14:20:00.000Z"
  }
];

export function normalizeTaskInput(
  input: Partial<TaskInput>,
  allowedProjects: string[] = defaultProjects,
  allowedAssignees?: string[]
): TaskInput {
  const projectOptions = allowedProjects.length > 0 ? allowedProjects : defaultProjects;
  const assigneeValue = String(input.assignee ?? "").trim();
  const assignee =
    allowedAssignees && allowedAssignees.length > 0
      ? allowedAssignees.includes(assigneeValue)
        ? assigneeValue
        : allowedAssignees[0]
      : assigneeValue;

  return {
    title: String(input.title ?? "").trim(),
    description: String(input.description ?? "").trim(),
    assignee,
    dueDate: String(input.dueDate ?? ""),
    priority: priorities.includes(input.priority as Priority) ? (input.priority as Priority) : "Normal",
    status: statuses.includes(input.status as Status) ? (input.status as Status) : "To Do",
    project: projectOptions.includes(String(input.project)) ? String(input.project) : projectOptions[0],
    tags: Array.isArray(input.tags) ? input.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    estimate: Math.max(1, Number(input.estimate) || 1),
    id: input.id,
    createdAt: input.createdAt
  };
}
