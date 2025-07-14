/**
 * @jest-environment node
 */

import { exec, execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

import chai from 'chai';
import {
    DockerContainer,
    filterContainersByImage,
    fetchDockerContainers,
    extractContainerLogs,
} from './util';

const { expect } = chai;

const TEST_CONTAINER_NAME = 'docker-gh-logs-tester';
const TEST_CONTAINER_IMAGE = 'ubuntu:22.10';
const TEMP_OUTPUT_DIR = path.resolve(process.cwd(), 'testOut');

function launchTestContainer(): void {
    execSync(`docker run --name=${TEST_CONTAINER_NAME} ${TEST_CONTAINER_IMAGE} echo "foo"`);
}

function removeTestContainer(): void {
    try {
        execSync(`docker rm -f ${TEST_CONTAINER_NAME}`);
    } catch {
        // Ignore errors if container doesn't exist
    }
}

describe('docker-logs-extractor', () => {
    beforeAll(async () => {
        removeTestContainer();

        // Create the test output directory and clean it from previous runs.
        await fs.mkdir(TEMP_OUTPUT_DIR, { recursive: true });
        const existingFiles = await fs.readdir(TEMP_OUTPUT_DIR);
        for (const file of existingFiles) {
            await fs.rm(path.resolve(TEMP_OUTPUT_DIR, file));
        }
    });

    it('should discover containers and extract their logs', async () => {
        try {
            launchTestContainer();
            const discoveredContainers = fetchDockerContainers().filter(
                (container) => container.containerName === TEST_CONTAINER_NAME
            );
            const testContainer = discoveredContainers.find(
                (container) => container.containerName === TEST_CONTAINER_NAME
            );
            if (!testContainer) {
                throw new Error('Test container not found in discovered containers');
            }

            expect(testContainer).to.eql({
                containerId: testContainer.containerId,
                imageName: TEST_CONTAINER_IMAGE,
                containerName: TEST_CONTAINER_NAME,
                currentStatus: testContainer.currentStatus,
            });

            const logFileName = `${testContainer.containerName.replace(/[/:]/g, '-')}.log`;
            const logFilePath = path.resolve(TEMP_OUTPUT_DIR, logFileName);
            extractContainerLogs(testContainer.containerId, { outputFilePath: logFilePath });

            const extractedLogs = await fs.readFile(logFilePath, { encoding: 'utf-8' });
            expect(extractedLogs, 'extracted log contents').to.contain('foo');
        } finally {
            removeTestContainer();
        }
    });

    it('should filter containers by image name patterns', () => {
        const mockContainers: DockerContainer[] = [
            {
                containerId: 'fake-id-1',
                imageName: 'ubuntu:22.10',
                containerName: 'test',
                currentStatus: 'Created',
            },
            {
                containerId: 'fake-id-2',
                imageName: 'ubuntu-not:22.10',
                containerName: 'fake',
                currentStatus: 'Up 3 days',
            },
            {
                containerId: 'fake-id-3',
                imageName: 'postgres:14',
                containerName: 'db',
                currentStatus: 'Up 9 days',
            },
        ];

        const filteredContainers = filterContainersByImage(mockContainers, ['ubuntu', 'postgres']);
        expect(filteredContainers).to.eql([
            {
                containerId: 'fake-id-1',
                imageName: 'ubuntu:22.10',
                containerName: 'test',
                currentStatus: 'Created',
            },
            {
                containerId: 'fake-id-3',
                imageName: 'postgres:14',
                containerName: 'db',
                currentStatus: 'Up 9 days',
            },
        ]);
    });

    it('should return all containers when no filter is provided', () => {
        const mockContainers: DockerContainer[] = [
            {
                containerId: 'fake-id-1',
                imageName: 'ubuntu:22.10',
                containerName: 'test',
                currentStatus: 'Created',
            },
            {
                containerId: 'fake-id-2',
                imageName: 'nginx:latest',
                containerName: 'web',
                currentStatus: 'Up 1 day',
            },
        ];

        const result = filterContainersByImage(mockContainers, undefined);
        expect(result).to.eql(mockContainers);
    });

    it('should handle case-insensitive image filtering', () => {
        const mockContainers: DockerContainer[] = [
            {
                containerId: 'fake-id-1',
                imageName: 'Ubuntu:22.10',
                containerName: 'test',
                currentStatus: 'Created',
            },
            {
                containerId: 'fake-id-2',
                imageName: 'NGINX:latest',
                containerName: 'web',
                currentStatus: 'Up 1 day',
            },
        ];

        const filteredContainers = filterContainersByImage(mockContainers, ['ubuntu', 'nginx']);
        expect(filteredContainers).to.have.length(2);
        expect(filteredContainers[0].imageName).to.equal('Ubuntu:22.10');
        expect(filteredContainers[1].imageName).to.equal('NGINX:latest');
    });
});
