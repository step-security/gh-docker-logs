import * as core from '@actions/core';
import fs from 'fs';
import path from 'path';
import { filterContainersByImage, fetchDockerContainers, extractContainerLogs } from './util';
import axios, { isAxiosError } from 'axios';

async function validateSubscription(): Promise<void> {
    const API_URL = `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/subscription`;

    try {
        await axios.get(API_URL, { timeout: 3000 });
    } catch (error) {
        if (isAxiosError(error) && error.response) {
            core.error('Subscription is not valid. Reach out to support@stepsecurity.io');
            process.exit(1);
        } else {
            core.info('Timeout or API not reachable. Continuing to next step.');
        }
    }
}

interface ProcessingConfiguration {
    destinationDirectory?: string;
    imageFilterArray?: string[];
    tailFlag: string;
    shellCommand: string;
}

function parseInputConfiguration(): ProcessingConfiguration {
    const destinationDirectory = core.getInput('dest') || undefined;
    const targetImages = core.getInput('images') || undefined;
    const tailFlag = core.getInput('tail');
    const shellCommand = core.getInput('shell');

    const imageFilterArray = targetImages
        ? targetImages
              .split(',')
              .map((img: string) => img.trim())
              .filter((img: string) => img.length > 0)
        : undefined;

    return { destinationDirectory, imageFilterArray, tailFlag, shellCommand };
}

const config = parseInputConfiguration();

function setupDestinationDirectory(directory?: string): void {
    if (directory) {
        try {
            fs.mkdirSync(directory, { recursive: true });
        } catch (error) {
            core.setFailed(`Failed to create destination directory: ${error}`);
            return;
        }
    }
}

async function processDockerContainers(config: ProcessingConfiguration): Promise<void> {
    await validateSubscription();
    const discoveredContainers = fetchDockerContainers({ shell: config.shellCommand });

    if (discoveredContainers.length === 0) {
        console.log('No Docker containers found.');
        return;
    }

    console.log(`Found ${discoveredContainers.length} containers...`);
    const matchingContainers = filterContainersByImage(
        discoveredContainers,
        config.imageFilterArray
    );

    if (config.imageFilterArray) {
        console.log(`Found ${matchingContainers.length} matching containers...`);
    }

    if (matchingContainers.length === 0) {
        console.log('No containers match the specified filters.');
        return;
    }

    console.log('\n');

    processContainerLogs(matchingContainers, config);
}

function processContainerLogs(containers: any[], config: ProcessingConfiguration): void {
    for (const dockerContainer of containers) {
        if (!config.destinationDirectory) {
            displayContainerInfo(dockerContainer);
            extractContainerLogs(dockerContainer.containerId, { tail: !!config.tailFlag });
            console.log(`::endgroup::`);
        } else {
            writeContainerLogsToFile(dockerContainer, config);
        }
    }
}

function displayContainerInfo(container: any): void {
    console.log(`::group::${container.imageName} (${container.containerName})`);
    console.log('**********************************************************************');
    console.log(`* Name  : ${container.containerName}`);
    console.log(`* Image : ${container.imageName}`);
    console.log(`* Status: ${container.currentStatus}`);
    console.log('**********************************************************************');
}

function writeContainerLogsToFile(container: any, config: ProcessingConfiguration): void {
    const logFileName = `${container.containerName.replace(/[/:]/g, '-')}.log`;
    const fullLogPath = path.resolve(config.destinationDirectory!, logFileName);
    console.log(`Writing ${fullLogPath}`);
    extractContainerLogs(container.containerId, {
        tail: !!config.tailFlag,
        outputFilePath: fullLogPath,
    });
}

setupDestinationDirectory(config.destinationDirectory);
processDockerContainers(config);
