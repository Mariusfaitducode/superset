import { TaskMonitorPanel } from "./components/TaskMonitorPanel";
import { useTaskNotifications } from "./hooks/useTaskNotifications";
import { useTrackedTasks } from "./hooks/useTrackedTasks";

/** Mounted once per window: the panel, and the notifications of task ends. */
export function TaskMonitor() {
	const { byHost } = useTrackedTasks();
	useTaskNotifications(byHost);
	return <TaskMonitorPanel />;
}
