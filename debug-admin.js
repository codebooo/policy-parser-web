async function run() {
    try {
        const res = await fetch('http://localhost:3000/api/setup-admin');
        const data = await res.json();
        console.log('Status:', res.status);
        console.log('Body:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

run();
