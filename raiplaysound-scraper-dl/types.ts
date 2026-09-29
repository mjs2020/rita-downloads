export type Program = {
    name: string;
    url: string;
    subfolder: string;
    fromDate?: string;
};

export type Config = {
    programs: Program[];
    outputBasePath: string;
    baseUrl?: string;
    tmpDir: string;
    maxRetries: number;
    downloadsPerRun: number;
    scrapeInterval?: number;
    programsPerScrape?: number;
    programConcurrency?: number;
    pageConcurrency?: number;
    jsonConcurrency?: number;
    requestTimeoutMs?: number;
    requestRetries?: number;
    maxPagesPerProgram?: number;
    scrapeTimeoutMs?: number;
};

export type Episode = {
    mediapolisUrl: string;
    program: Program;
    uniqueName: string;
    title: string;
    date: Date;
}

export type History = {
    downloadedEpisodes: string[]
    failedEpisodes: {
        [key: string]: number
    }
    taskQueue: Episode[]
    programLastScraped: {
        [key: string]: string
    }
}

export type DownloadResult = {
    successful: boolean;
    episode: Episode;
}

export class DownloadResults {
    successfulDownloads: Episode[] = [];
    failedDownloads: Episode[] = [];
}
