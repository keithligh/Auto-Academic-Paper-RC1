
const testStrings = [
    "Typical wake time Early (\\approx 06{:}30)",
    "Lane B (Culture \\/ Food)",
    "Just a normal \\checkmark check"
];

function clean(text) {
    let res = text
        .replace(/\\checkmark/g, '&#10003;')
        .replace(/\\approx/g, '&#8776;') // Numeric entity for approx
        .replace(/\\{:\}/g, ':') // Attempt 1: match \{:\} (wrong if no backslash)
        .replace(/\{:\}/g, ':')  // Attempt 2: match {:}
        .replace(/\\\//g, '/'); // Keep the slash, remove the backslash? Or remove everything? User said "Culture \/ Food" -> likely means "Culture / Food" or "Culture or Food".
    // LaTeX \/ is italic correction (invisible space).
    // But here it might be an escaped slash?
    // If it's escaped slash, it should be /.
    // If it's italic correction, it should be empty.
    // Context "Culture \/ Food" implies "Culture / Food".

    return res;
}

testStrings.forEach(s => {
    console.log(`Original: ${s}`);
    console.log(`Cleaned:  ${clean(s)}`);
});
