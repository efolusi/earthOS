import { runPluginContractTests } from '@earthos/testing';

runPluginContractTests(() => import('../src/plugin'));
