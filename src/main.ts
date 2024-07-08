import * as core from '@actions/core';
import axios, { isAxiosError } from 'axios';
import fs from 'fs';
import path from 'path';
import { filterContainers, getContainers, getLogsFromContainer } from './lib';

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

// Main function to run the script
async function main() {
    await validateSubscription();

    const dest = core.getInput('dest') || undefined;
    const images = core.getInput('images') || undefined;
    const tail = core.getInput('tail');
    const shell = core.getInput('shell');

    const imagesFilter = typeof images === 'string' ? images.split(',') : undefined;

    if (dest) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const containers = getContainers({ shell });

    console.log(`Found ${containers.length} containers...`);
    const filteredContainers = filterContainers(containers, imagesFilter);
    if (imagesFilter) {
        console.log(`Found ${filteredContainers.length} matching containers...`);
    }
    console.log('\n');

    for (const container of filteredContainers) {
        if (!dest) {
            console.log(`::group::${container.image} (${container.name})`);
            console.log('**********************************************************************');
            console.log(`* Name  : ${container.name}`);
            console.log(`* Image : ${container.image}`);
            console.log(`* Status: ${container.status}`);
            console.log('**********************************************************************');

            getLogsFromContainer(container.id, { tail: !!tail });
            console.log(`::endgroup::`);
        } else {
            const logFile = `${container.name.replace(/[/:]/g, '-')}.log`;
            const filename = path.resolve(dest, logFile);
            console.log(`Writing ${filename}`);
            getLogsFromContainer(container.id, { tail: !!tail, filename });
        }
    }
}

// Run the main function
main().catch((error) => {
    core.setFailed(`Script failed: ${error.message}`);
});
