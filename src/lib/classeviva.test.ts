import { describe, expect, it } from "vitest";
import { classifyAgenda, fetchAgenda, fetchGrades, login, titleCase } from "./classeviva";

function mockFetch(routes: Record<string, unknown>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const key = Object.keys(routes).find((k) => url.endsWith(k));
    if (!key) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(routes[key]), { status: 200 });
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe("ClasseViva client", () => {
  it("logs in and derives the numeric student id", async () => {
    const { f, calls } = mockFetch({ "/auth/login": { ident: "S1234567X", token: "tok", expire: "x" } });
    const s = await login("S1234567X", "pw", f);
    expect(s).toMatchObject({ token: "tok", studentId: "1234567" });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ ident: null, pass: "pw", uid: "S1234567X" });
  });

  it("maps grades, dropping cancelled and non-numeric ones", async () => {
    const { f, calls } = mockFetch({
      "/students/1/grades": {
        grades: [
          { subjectDesc: "MATEMATICA", evtDate: "2026-11-10", decimalValue: 6.5, weightFactor: 1, componentDesc: "Scritto" },
          { subjectDesc: "MATEMATICA", evtDate: "2026-11-11", decimalValue: null },
          { subjectDesc: "FISICA", evtDate: "2026-11-12", decimalValue: 4, canceled: true },
        ],
      },
    });
    const grades = await fetchGrades({ token: "t", studentId: "1", expire: "" }, f);
    expect(grades).toEqual([{ subject: "Matematica", value: 6.5, date: "2026-11-10", weight: 1, kind: "Scritto" }]);
    expect((calls[0].init?.headers as Record<string, string>)["Z-Auth-Token"]).toBe("t");
  });

  it("classifies agenda entries and infers the subject from the teacher", async () => {
    const { f } = mockFetch({
      "/agenda/all/20261130/20261220": {
        agenda: [
          { evtId: 1, evtCode: "AGNT", evtDatetimeBegin: "2026-12-03T08:00:00+01:00", notes: "Verifica sistemi", subjectDesc: null, authorName: "ROSSI MARIA" },
          { evtId: 2, evtCode: "AGHW", evtDatetimeBegin: "2026-12-02T09:00:00+01:00", notes: "pag 12", subjectDesc: "FISICA", authorName: "BIANCHI" },
        ],
      },
      "/subjects": { subjects: [{ description: "MATEMATICA", teachers: [{ teacherName: "ROSSI MARIA" }] }] },
    });
    const items = await fetchAgenda({ token: "t", studentId: "1", expire: "" }, "2026-11-30", "2026-12-20", f);
    expect(items).toEqual([
      { id: "1", subject: "Matematica", date: "2026-12-03", kind: "verifica", text: "Verifica sistemi" },
      { id: "2", subject: "Fisica", date: "2026-12-02", kind: "compito", text: "pag 12" },
    ]);
  });

  it("classifies common Italian wording", () => {
    expect(classifyAgenda("AGNT", "Interrogazione programmata")).toBe("interrogazione");
    expect(classifyAgenda("AGNT", "Compito in classe di latino")).toBe("verifica");
    expect(classifyAgenda("AGNT", "Uscita didattica")).toBe("altro");
    expect(titleCase("LINGUA E CULTURA LATINA")).toBe("Lingua e cultura latina");
  });
});

describe("describeFailure", () => {
  it("recognises the anti-bot block", async () => {
    const { describeFailure } = await import("./classeviva");
    const r = new Response("<HTML><HEAD><TITLE>Access Denied</TITLE></HEAD><BODY>Reference #18.abc</BODY></HTML>", { status: 403 });
    expect(await describeFailure(r)).toContain("anti-bot");
    const j = new Response(JSON.stringify({ error: "auth.denied", info: "wrong credentials" }), { status: 403 });
    expect(await describeFailure(j)).toBe("HTTP 403: auth.denied · wrong credentials");
  });
});
