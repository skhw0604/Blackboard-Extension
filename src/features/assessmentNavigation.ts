import type { Todo } from "../type";

const baseUrl = "https://blackboard.unist.ac.kr";

export const getAssessmentUrl = (courseId: string, contentId: string) => {
    const course = encodeURIComponent(courseId);
    return `${baseUrl}/ultra/courses/${course}/assessment/${encodeURIComponent(contentId)}/overview?courseId=${course}`;
};

export const getTodoLink = (todo: Todo): string | undefined => {
    if (!todo.linkcode) return undefined;
    if (todo.courseId && todo.contentId) return getAssessmentUrl(todo.courseId, todo.contentId);
    if (/^https?:\/\//.test(todo.linkcode)) return todo.linkcode;
    return `${baseUrl}/webapps/calendar/launch/attempt/${encodeURIComponent(todo.linkcode)}`;
};

const convertAssessmentLink = (link: string): string | undefined => {
    const url = new URL(link);
    if (url.origin !== baseUrl) return undefined;
    if (url.pathname !== "/webapps/assessment/take/launchAssessment.jsp") return undefined;
    const courseId = url.searchParams.get("course_id");
    const contentId = url.searchParams.get("content_id");
    return courseId && contentId ? getAssessmentUrl(courseId, contentId) : undefined;
};

export const resolveTodoLink = async (todo: Todo): Promise<string | undefined> => {
    const link = getTodoLink(todo);
    if (!link) return undefined;
    try {
        const directLink = convertAssessmentLink(link);
        if (directLink) return directLink;
        const url = new URL(link);
        if (url.origin !== baseUrl || !url.pathname.startsWith("/webapps/calendar/launch/attempt/")) return link;
        // Resolve the calendar redirect without displaying its legacy page.
        // This GET does not click Begin or submit a quiz attempt.
        const response = await fetch(link, { credentials: "include", redirect: "follow" });
        if (!response.ok) return link;
        const assessmentLink = convertAssessmentLink(response.url);
        if (assessmentLink) return assessmentLink;
        const destination = new URL(response.url);
        if (destination.origin === baseUrl && destination.pathname.startsWith("/ultra/courses/")) return response.url;
    } catch {
        // Keep the original link usable when the session or endpoint fails.
    }
    return link;
};
