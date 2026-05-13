import * as core from '@actions/core';
import fs from 'fs';
import path from 'path';
import { filterContainersByImage, fetchDockerContainers, extractContainerLogs } from './util';
import axios, { isAxiosError } from 'axios';

async function validateSubscription(): Promise<void> {
  const eventPath = process.env.GITHUB_EVENT_PATH
  let repoPrivate: boolean | undefined

  if (eventPath && fs.existsSync(eventPath)) {
    const eventData = JSON.parse(fs.readFileSync(eventPath, 'utf8'))
    repoPrivate = eventData?.repository?.private
  }

  const upstream = 'jwalton/gh-docker-logs'
  const action = process.env.GITHUB_ACTION_REPOSITORY
  const docsUrl =
    'https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions'

  core.info('')
  core.info('[1;36mStepSecurity Maintained Action[0m')
  core.info(`Secure drop-in replacement for ${upstream}`)
  if (repoPrivate === false)
    core.info('[32m✓ Free for public repositories[0m')
  core.info(`[36mLearn more:[0m ${docsUrl}`)
  core.info('')

  if (repoPrivate === false) return

  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com'
  const body: Record<string, string> = {action: action || ''}
  if (serverUrl !== 'https://github.com') body.ghes_server = serverUrl
  try {
    await axios.post(
      `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/maintained-actions-subscription`,
      body,
      {timeout: 3000}
    )
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 403) {
      core.error(
        `[1;31mThis action requires a StepSecurity subscription for private repositories.[0m`
      )
      core.error(
        `[31mLearn how to enable a subscription: ${docsUrl}[0m`
      )
      process.exit(1)
    }
    core.info('Timeout or API not reachable. Continuing to next step.')
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
