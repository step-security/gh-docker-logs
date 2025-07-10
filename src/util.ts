import { execSync, StdioOptions } from 'child_process';
import { Stream } from 'stream';
import fs from 'fs';

export interface DockerContainer {
    containerId: string;
    imageName: string;
    containerName: string;
    currentStatus: string;
}

function executeCommand(
    command: string,
    executionOptions: {
        shell?: string;
        passthrough?: boolean;
        outputStream?: Stream | number;
    } = {}
) {
    let standardIoOptions: StdioOptions;

    if (executionOptions.passthrough) {
        standardIoOptions = 'inherit';
    } else if (executionOptions.outputStream) {
        standardIoOptions = ['pipe', executionOptions.outputStream, executionOptions.outputStream];
    } else {
        standardIoOptions = 'pipe';
    }

    return execSync(command, {
        shell: executionOptions.shell,
        encoding: 'utf-8',
        env: process.env,
        stdio: standardIoOptions,
    });
}

export function fetchDockerContainers(commandOptions: { shell?: string } = {}): DockerContainer[] {
    try {
        const dockerProcessList = executeCommand(
            'docker ps -a --format "table {{.ID}},{{.Image}},{{.Names}},{{.Status}}" --no-trunc',
            { shell: commandOptions.shell }
        );

        const processListLines = dockerProcessList.split(/\r?\n/).slice(1);

        return processListLines
            .filter((line: string) => line.trim() !== '')
            .map((line: string) => {
                const containerData = line.split(',');
                if (containerData.length < 4) {
                    throw new Error(`Invalid container data format: ${line}`);
                }
                const [containerId, imageName, containerName, currentStatus] = containerData;
                return { containerId, imageName, containerName, currentStatus };
            });
    } catch (error) {
        console.error('Failed to fetch Docker containers:', error);
        return [];
    }
}

export function filterContainersByImage(
    dockerContainers: DockerContainer[],
    imageFilterList: string[] | undefined
): DockerContainer[] {
    if (!imageFilterList || imageFilterList.length === 0) {
        return dockerContainers;
    }

    const normalizedFilters = imageFilterList.map((filter: string) => filter.trim().toLowerCase());

    return dockerContainers.filter((container) => {
        const normalizedImageName = container.imageName.toLowerCase();

        return normalizedFilters.some((filter: string) => {
            return normalizedImageName === filter || normalizedImageName.startsWith(`${filter}:`);
        });
    });
}

export function extractContainerLogs(
    targetContainerId: string,
    logOptions: { tail?: boolean; outputFilePath?: string }
): void {
    const { tail, outputFilePath } = logOptions;
    const dockerLogArguments = tail ? `--tail ${tail} ` : '';

    let fileDescriptor: number | undefined;

    try {
        if (outputFilePath) {
            fileDescriptor = fs.openSync(outputFilePath, 'w');
        }

        executeCommand(`docker logs ${dockerLogArguments} ${targetContainerId}`, {
            passthrough: !outputFilePath,
            outputStream: fileDescriptor,
        });
    } catch (error) {
        console.error(`Failed to extract logs for container ${targetContainerId}:`, error);
    } finally {
        if (fileDescriptor !== undefined) {
            try {
                fs.closeSync(fileDescriptor);
            } catch (closeError) {
                console.error('Failed to close file descriptor:', closeError);
            }
        }
    }
}
