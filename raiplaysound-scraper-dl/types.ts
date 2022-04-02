export type Program = {
    name: string;
    url: string;
    subfolder: string;
};

export type Config = {
    programs: Program[];
    outputBasePath: string;
    historyPath: string;
    baseUrl: string;
    tmpDir: string;
    jquerySelector: string;
    maxRetries: number;
    downloadsPerRun: number;
};

export type Episode = {
    mediapolisUrl: string;
    program: string;
    uniqueName: string;
    title: string;
    date: Date;
}