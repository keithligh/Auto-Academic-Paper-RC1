// Check what webtex exports
async function checkWebTeX() {
    const webtex = await import('webtex');

    console.log('WebTeX exports:');
    console.log(Object.keys(webtex));
    console.log('\nWebTeX default export:');
    console.log(webtex.default);
    console.log('\nWebTeX type:', typeof webtex.default);
}

checkWebTeX().catch(console.error);
