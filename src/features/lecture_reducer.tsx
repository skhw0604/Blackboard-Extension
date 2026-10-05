/// <reference types="chrome" />
/// <reference types="vite-plugin-svgr/client" />

import { createSlice } from "@reduxjs/toolkit";
import { Lecture, ShapedLecture, AssignmentList, Assignment, Todo, BB_alarm, AlignWith, FileUrl } from "type";
import { AppDispatch, RootState } from "./store";
import { RawAlarm, convertBB_alarm } from "./rawAlarmHandler";
import { getChromeStorage, setChromeStorage, APIwithcatch, setChromeStorageList, getChromeStorageList } from "./handleChromeStoarge";
import { get } from "https";
interface LectureList {
    [key: string]: Lecture;
}
export interface InitialState {
    lectureSlice: LectureList;
    shapedLectureList: ShapedLecture[][];
    isLectureLoaded: boolean;
    todoList: Todo[];
    deletedTodoList: Todo[];
    bb_alarmList: BB_alarm[];
    alignWith: AlignWith;
    checkedFiles: FileUrl[];
}
let initialState: InitialState = {
    lectureSlice: {},
    shapedLectureList: [[], [], [], [], [], []],
    isLectureLoaded: false,
    todoList: [],
    deletedTodoList: [],
    bb_alarmList: [],
    alignWith: "date",
    checkedFiles: [],
};
let colorlist: string[] = ["#f2e8e8", "#ffe9e9", "#eff9cc", "#dcf2e9", "#dee8f6", "#fff8cc", "#ffedda", "#dceef2", "#ddd6fe", "#e0e7ff", "#f0abfc", "#7dd3fc"];
export const lectureSlice = createSlice({
    name: "lectureSlice",
    initialState: initialState,
    reducers: {
        setLectureList: (state, action) => {
            state.lectureSlice = action.payload;
        },
        setShapedLectureList: (state, action) => {
            state.shapedLectureList = action.payload;
            state.isLectureLoaded = true;
        },
        setLectureAssignment: (state, action) => {
            let lecture = state.lectureSlice[action.payload.lectureID];
        },
        setTodoList: (state, action) => {
            state.todoList = action.payload;
        },
        addTodo: (state, action) => {
            state.todoList.push(action.payload);
        },
        addDeletedTodo: (state, action) => {
            state.deletedTodoList.push(action.payload);
        },
        resetDeletedTodo(state) {
            state.deletedTodoList = [];
        },
        setBB_alarms: (state, action) => {
            state.bb_alarmList = action.payload;
        },
        setAlignWith: (state, action) => {
            state.alignWith = action.payload;
        },
        addCheckedFile: (state, action) => {
            if (state.checkedFiles.find((file) => file.fileURL == action.payload.fileURL) == undefined) {
                // check if file is already checked
                state.checkedFiles.push(action.payload);
            }
        },
        removeCheckedFile: (state, action) => {
            state.checkedFiles = state.checkedFiles.filter((file) => file.fileURL != action.payload.fileURL);
        },
        setCheckedFiles: (state, action) => {
            state.checkedFiles = action.payload;
        },
        deleteSelectedFiles: (state) => {
            // delete files inside lectureList.assignment
            state.checkedFiles.forEach((file) => {
                Object.entries(state.lectureSlice).forEach(([key, value]) => {
                    let assignments = value.assignment;
                    assignments.forEach((assignment, index) => {
                        state.lectureSlice[key].assignment[index].Assignment_Files = assignment.Assignment_Files.filter(
                            (fileUrl) => fileUrl.fileURL != file.fileURL
                        );
                        state.lectureSlice[key].assignment[index].fileUrl = assignment.fileUrl.filter(
                            (fileUrl) => fileUrl.fileURL != file.fileURL
                        );
                    });
                });
            });
        },
    },
});
export const {
    setLectureList,
    setShapedLectureList,
    setLectureAssignment,
    setTodoList,
    addTodo,
    addDeletedTodo,
    resetDeletedTodo,
    setBB_alarms,
    setAlignWith,
    addCheckedFile,
    setCheckedFiles,
    removeCheckedFile,
    deleteSelectedFiles,
} = lectureSlice.actions;
export const getMemberShip = async (dispatch: AppDispatch) => {
    let storedMemberShip = localStorage.getItem("memberships");
    if (!storedMemberShip) {
        return getLectureList(dispatch);
    }
    storedMemberShip = JSON.parse(storedMemberShip);
    let lectureList = await convertMemberShip(storedMemberShip);
    lectureList = await updateFileInfo(lectureList);
    dispatch(setLectureList(lectureList));
    getShapedLectureList(dispatch, lectureList);
    await setChromeStorage("lectureInfo", JSON.stringify(lectureList));
};
function shuffle<T>(array: T[]): T[] {
    let currentIndex = array.length, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }

    return array;
};
const convertMemberShip = async (alarmList: any): Promise<LectureList> => {
    let lectureList: LectureList = {};
    for (let i = 0; i < alarmList.length; i++) {
        const course = alarmList[i].course;
        let lecture: Lecture = {
            id: course.id,
            name: "",
            engName: course.displayName || course.name || course.displayId || "",
            link: course.externalAccessUrl,
            isLecture: true,
            color: "",
            assignment: [],
            time: "",
            professor: "",
            calendarId: course.courseId || course.id,
        };
        const lectureKey = course.displayId?.split("_")[1] || course.id || course.courseId;
        if (course.effectiveAvailability) {
            lectureList[lectureKey] = lecture;
        }
    }
    const response = await fetch(window.chrome.runtime.getURL('public/assets/lectureInfo.json'));
    const jsonData = await response.json();

    let c = 0;
    for (let key in lectureList) {
        const catalogInfo = jsonData[key];
        if (catalogInfo === undefined) {
            lectureList[key].isLecture = false;
        } else {
            c++;
            lectureList[key].name = catalogInfo.name;
            lectureList[key].color = colorlist[c % colorlist.length];
            lectureList[key].time = catalogInfo.time;
            lectureList[key].professor = catalogInfo.professor;
            if (catalogInfo.timeplace0) {
                lectureList[key].timeplace0 = catalogInfo.timeplace0;
            }
            if (catalogInfo.timeplace1) {
                lectureList[key].timeplace1 = catalogInfo.timeplace1;
            }
            if (catalogInfo.timeplace2) {
                lectureList[key].timeplace2 = catalogInfo.timeplace2;
            }
        }
    }

    return lectureList;

}
const getShapedLectureList = (dispatch: AppDispatch, lectureList: LectureList) => {
    let l: ShapedLecture[][] = [[], [], [], [], [], []];
    let i = 0;
    let key: string;
    for (key in lectureList) {
        let item: any = lectureList[key];
        i += 1;
        for (let c = 0; c < 3; c++) {
            if (item["timeplace" + c]) {
                let newItem: ShapedLecture = {
                    name: item["name"],
                    professor: item["professor"],
                    time: item["time"],
                    link: item["link"],
                    color: item["color"],
                    timeplace: item["timeplace" + c],
                };
                l[item["timeplace" + c].day].push(newItem);
            }
        }
    }
    dispatch(setShapedLectureList(l));
}
const updateFileInfo = async (lectureList: LectureList) => {
    let assignmentList: AssignmentList = JSON.parse(localStorage.getItem("fileInfo") || "{}");
    //check if fileinfo is empty
    if (Object.keys(assignmentList).length == 0) {
        console.error("fileInfo is empty");
        return lectureList;
    }
    Object.entries(assignmentList).forEach(([key1, value1]) => {
        let course_id: string = key1.split("-")[1];
        Object.entries(lectureList).forEach(([key2, value]) => {
            let lecture: any = value;
            if (lecture.id == course_id) {
                lectureList[key2].assignment.push(value1 as Assignment);
            }
        });
    });
    return lectureList;
}
export const getLectureList = async (dispatch: AppDispatch) => {
    let lectureInfoStr = await getChromeStorage("lectureInfo", "{}");
    let resLecturelist: LectureList = JSON.parse(lectureInfoStr);
    resLecturelist = await updateFileInfo(resLecturelist);
    dispatch(setLectureList(resLecturelist));
    getShapedLectureList(dispatch, resLecturelist);
};
export const getTodoList = async (dispatch: AppDispatch) => {
    let todoList: Todo[] = await getChromeStorageList("todoList");

    dispatch(setTodoList(todoList));
    //postTodoList(todoList);
};
const gradebookContentIdCache = new Map<string, Promise<string | undefined>>();
const getGradebookContentId = (courseId: string, columnId: string): Promise<string | undefined> => {
    const cacheKey = `${courseId}:${columnId}`;
    const cached = gradebookContentIdCache.get(cacheKey);
    if (cached) return cached;

    const request = fetch(
        `https://blackboard.unist.ac.kr/learn/api/public/v2/courses/${encodeURIComponent(courseId)}/gradebook/columns/${encodeURIComponent(columnId)}`,
        { credentials: "include" }
    )
        .then(async (response) => {
            if (!response.ok) return undefined;
            const column = await response.json();
            return typeof column.contentId === "string" ? column.contentId : undefined;
        })
        .catch(() => undefined);

    gradebookContentIdCache.set(cacheKey, request);
    return request;
};
export const resetTodoList = async (dispatch: AppDispatch) => {
    // Refresh keeps tasks the user has deleted hidden.
    await reloadTodoList(dispatch);
};
export const reloadTodoList = async (dispatch: AppDispatch) => {
    // Match each event by Blackboard ID, while keeping existing Korean labels.
    const membershipData = localStorage.getItem("memberships");
    const courseNames = new Map<string, string>();
    let courseNameCatalog: Record<string, { name?: string }> = {};
    if (membershipData) {
        await getMemberShip(dispatch);
    }
    // Calendar labels can supply a course code even without captured memberships.
    try {
        const response = await fetch(window.chrome.runtime.getURL("public/assets/lectureInfo.json"));
        if (response.ok) courseNameCatalog = await response.json();
    } catch (error) {
        console.warn("Blackboard course name catalog could not be loaded.", error);
    }
    let todoList: Todo[] = await getChromeStorageList("todoList");
    const fetchUrl =
        "https://blackboard.unist.ac.kr/webapps/calendar/calendarData/selectedCalendarEvents?start=" +
        Date.now() +
        "&end=2147483647000";
    const fetchData = await APIwithcatch(fetchUrl, "{}");
    if (!Array.isArray(fetchData)) {
        console.warn("Blackboard calendar did not return an event list.");
        dispatch(getTodoList);
        return;
    }
    todoList = todoList.filter((todo) => !todo.linkcode);
    let resLecturelistStr = await getChromeStorage("lectureInfo", "{}");
    let resLecturelist: LectureList = JSON.parse(resLecturelistStr);
    if (membershipData) {
        for (const membership of JSON.parse(membershipData)) {
            const course = membership.course;
            const catalogKey = course.displayId?.split("_")[1];
            const name = courseNameCatalog[catalogKey]?.name || course.displayName || course.name || course.displayId;
            if (name) {
                if (course.id) courseNames.set(course.id, name);
                if (course.courseId) courseNames.set(course.courseId, name);
            }
        }
    }
    // remove deleted todo
    let deletedTodoListStr = await getChromeStorage("deletedTodoList", "[]");
    let deletedTodoList: Todo[] = JSON.parse(deletedTodoListStr);
    const deletedIds = new Set(deletedTodoList.map((todo) => todo.linkcode).filter(Boolean));
    for (let key in fetchData) {
        if (deletedIds.has(fetchData[key]["id"])) continue;
        if (fetchData[key]["calendarName"] == "Personal" || fetchData[key]["calendarName"].includes("ULP")) {
            continue;
        }
        // Calendar events remain useful even when the static timetable catalog
        // has no entry for this course, or memberships have not loaded yet.
        let lectureColor: string = "#F5F5F5";
        let korLectureName: string = fetchData[key]["calendarName"];
        Object.entries(resLecturelist).forEach(([key2, value]) => {
            let lecture: Lecture = value;
            if (lecture.calendarId == fetchData[key]["calendarId"] || lecture.id == fetchData[key]["calendarId"]) {
                lectureColor = lecture.color || lectureColor;
                korLectureName = lecture.name || lecture.engName || korLectureName;
            }
        });
        const eventCourseId = fetchData[key]["courseId"] ?? fetchData[key]["course_id"] ?? fetchData[key]["calendarId"];
        const calendarCourseCode = String(fetchData[key]["calendarName"] || "")
            .match(/(?:^|_)([A-Z]+\d+)(?=[:\s_]|$)/)?.[1];
        const calendarCourseName = calendarCourseCode ? courseNameCatalog[calendarCourseCode]?.name : undefined;
        korLectureName = calendarCourseName || courseNames.get(eventCourseId) || korLectureName;
        let newStartString = fetchData[key]["start"];
        let newDate = new Date(newStartString);
        let assignName = fetchData[key]["title"];
        let link = "";
        let courseId: string | undefined;
        let contentId: string | undefined;
        if (fetchData[key]["calendarName"] !== "Personal") {
            assignName = korLectureName + ": " + assignName;
            link = fetchData[key]["id"];
            courseId = fetchData[key]["courseId"] ?? fetchData[key]["course_id"] ?? fetchData[key]["calendarId"];
            contentId = fetchData[key]["contentId"] ?? fetchData[key]["content_id"];
            if (!contentId && courseId && fetchData[key]["id"]) {
                contentId = await getGradebookContentId(courseId, fetchData[key]["id"]);
            }
        }
        let todo: Todo = {
            course_name: fetchData[key]["calendarName"],
            content: assignName,
            date: newDate.getTime(),
            color: lectureColor,
            linkcode: link,
            courseId,
            contentId,
        };
        todoList.push(todo);
    }
    // remove duplicated todo
    let newTodoList: Todo[] = [];
    for (let key in todoList) {
        let todo: Todo = todoList[key];
        let isDuplicated = false;
        for (let key2 in newTodoList) {
            let newTodo: Todo = newTodoList[key2];
            if (todo.content == newTodo.content && todo.date == newTodo.date && todo.linkcode == newTodo.linkcode) {
                isDuplicated = true;
            }
        }
        if (!isDuplicated) {
            newTodoList.push(todo);
        }
    }
    // A task may have been deleted while its content ID was being fetched.
    const latestDeleted: Todo[] = JSON.parse(await getChromeStorage("deletedTodoList", "[]"));
    const latestDeletedIds = new Set(latestDeleted.map((todo) => todo.linkcode).filter(Boolean));
    newTodoList = newTodoList.filter((todo) => !todo.linkcode || !latestDeletedIds.has(todo.linkcode));
    await setChromeStorageList("todoList", newTodoList);
    dispatch(setTodoList(newTodoList));
    //postTodoList(newTodoList);
};
export const deleteTodo = (dispatch: AppDispatch) => async (todo: Todo) => {
    if (todo.linkcode) {
        // check if linkcode exist to add only fetched todo
        dispatch(addDeletedTodo(todo));
        let deletedTodoListStr = await getChromeStorage("deletedTodoList", "[]");
        let deletedTodoList: Todo[] = JSON.parse(deletedTodoListStr);
        if (!deletedTodoList.some((deleted) => deleted.linkcode === todo.linkcode)) {
            deletedTodoList.push(todo);
        }
        await setChromeStorage("deletedTodoList", JSON.stringify(deletedTodoList));
    }
    let todoList: Todo[] = await getChromeStorageList("todoList");
    let newTodoList: Todo[] = [];
    //delete todo
    for (let key in todoList) {
        let newTodo: Todo = todoList[key];
        if (todo.linkcode ? todo.linkcode === newTodo.linkcode :
            !newTodo.linkcode && todo.content === newTodo.content && todo.date === newTodo.date) {
            continue;
        }
        newTodoList.push(newTodo);
    }
    await setChromeStorageList("todoList", newTodoList);
    //setChromeStorage("todoList", JSON.stringify(newTodoList));
    dispatch(setTodoList(newTodoList));
    //postTodoList(newTodoList);
};
export const addTodoItem = (dispatch: AppDispatch) => async (todo: Todo) => {
    // check if duplicated
    let todoList: Todo[] = await getChromeStorageList("todoList");
    for (let key in todoList) {
        let newTodo: Todo = todoList[key];
        if (todo.content == newTodo.content && todo.date == newTodo.date && todo.linkcode == newTodo.linkcode) {
            return;
        }
    }

    dispatch(addTodo(todo));
    todoList.push(todo);
    await setChromeStorageList("todoList", todoList);
};
export const reloadBB_alarms = async (dispatch: AppDispatch) => {
    // check if last fetch is within 5 minutes
    let lastAlarmFetch = await getChromeStorage("lastAlarmFetch", "0");
    if (Date.now() - parseInt(lastAlarmFetch) < 300000) {
        return;
    }
    const url = "https://blackboard.unist.ac.kr/webapps/streamViewer/streamViewer";
    const fetchdata = await fetch(url, {
        headers: {
            accept: "text/javascript, text/html, application/xml, text/xml, */*",
            "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "sec-ch-ua": '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-prototype-version": "1.7",
            "x-requested-with": "XMLHttpRequest",
        },
        referrer:
            "https://blackboard.unist.ac.kr/webapps/streamViewer/streamViewer?cmd=view&streamName=alerts&globalNavigation=false",
        referrerPolicy: "strict-origin-when-cross-origin",
        body: "cmd=loadStream&streamName=alerts&providers=%7B%7D&forOverview=false",
        method: "POST",
        mode: "cors",
        credentials: "include",
    });
    if (!fetchdata.ok) {
        return;
    }

    let alarmListStr = await fetchdata.text();
    if (!alarmListStr) {
        return;
    }
    let rawAlarmList = JSON.parse(alarmListStr).sv_streamEntries;
    if (rawAlarmList.length === 0) {
        console.log("failed to fetch alarm");
        let BB_alarms = await getChromeStorage("BB_alarms", "[]");
        dispatch(setBB_alarms(JSON.parse(BB_alarms)));
        return;
    }
    let BB_alarms = await convertBB_alarm(alarmListStr);
    dispatch(setBB_alarms(BB_alarms));
    await setChromeStorage("BB_alarms", JSON.stringify(BB_alarms));
    await setChromeStorage("lastAlarmFetch", Date.now().toString());

};
export const postTodoList = async (todoList: Todo[]) => {
    window.chrome.runtime.sendMessage({ action: "updateTodo", todoList: todoList });
};
export const selectLectureList = (state: RootState) => state.lectureSlice.lectureSlice;
export const selectShapedLectureList = (state: RootState) => state.lectureSlice.shapedLectureList;
export const selectIsLectureLoaded = (state: RootState) => state.lectureSlice.isLectureLoaded;
export const selectTodoList = (state: RootState) => state.lectureSlice.todoList;
export const selectBB_alarmList = (state: RootState) => state.lectureSlice.bb_alarmList;
export const selectAlignWith = (state: RootState) => state.lectureSlice.alignWith;
export const selectCheckedFiles = (state: RootState) => state.lectureSlice.checkedFiles;
export default lectureSlice.reducer;
