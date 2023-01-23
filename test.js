const a = process.env.FILES.replace(/\\/g,"");

console.log([...new Set(JSON.parse(a))]);
