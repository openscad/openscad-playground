const longTimeout = 60000;

const isProd = process.env.NODE_ENV === 'production';
const url = isProd ? 'http://localhost:3000/dist/' : 'http://localhost:4000';

describe('e2e', () => {
  test('should load the page', async () => {
    const messages = [];
    page.on('console', (msg) => messages.push({type: msg.type(), text: msg.text()}));
    page.goto(url);
    await page.waitForSelector('model-viewer');

    console.log('Messages:', JSON.stringify(messages, null, 2));
    
    const errors = messages.filter(msg => msg.type === 'error');
    expect(errors).toHaveLength(0);

    const successMessage = messages.filter(msg => msg.type === 'debug' && msg.text === 'stderr: Top level object is a list of objects:');
    expect(successMessage).toHaveLength(1);
  }, longTimeout);
});