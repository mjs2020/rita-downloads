export type Program = {
    name: string;
    url: string;
    subfolder: string;
};

export type Config = {
    programs: Program[];
    outputBasePath: string;
    baseUrl: string;
    tmpDir: string;
    jquerySelector: string;
    maxRetries: number;
    downloadsPerRun: number;
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
}

export type DownloadResult = {
    successful: boolean;
    episode: Episode;
}

export class DownloadResults {
    successfulDownloads: Episode[] = [];
    failedDownloads: Episode[] = [];
}