import earthos from '@earthos/config/eslint';

export default [...earthos, { ignores: ['.next/**', 'playwright-report/**', 'test-results/**'] }];
