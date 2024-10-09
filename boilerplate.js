const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const cliProgress = require('cli-progress');

// Function to fetch HTML content of results for a range of registration numbers
async function fetchAllResults(startRegNo, count, tempFile) {
    const progressBar = new cliProgress.SingleBar({
        format: 'Fetching [{bar}] {percentage}% | {value}/{total} Students',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
    }, cliProgress.Presets.shades_classic);

    // Start the progress bar
    progressBar.start(count, 0);

    for (let i = 0; i < count; i++) {
        const regNo = startRegNo + i;
        const url = `http://result.nu.ac.bd/results_latest/result_show.php?reg_no=${regNo}&exm_code=Bachelor%20Degree%20(Honours)%203rd%20Year&sub_code=1&exm_year=2022`;

        try {
            // Fetch the HTML content for the current registration number
            const { data } = await axios.get(url);

            // Save the raw HTML response into a temporary file (append mode)
            fs.appendFileSync(tempFile, `<student regNo="${regNo}">${data}</student>\n`);

            // Update the progress bar
            progressBar.update(i + 1);

            // Optional: delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`Error fetching result for Reg No: ${regNo}`, error);
        }
    }

    // Stop the progress bar
    progressBar.stop();
}

// Function to extract student info from the HTML content
function extractStudentInfo(html, regNo) {
    const $ = cheerio.load(html);

    // Extract student information
    const studentInfo = {
        regNO: regNo,
        name: $('table#customers')
            .find('tr')
            .first()
            .next()
            .find('td').eq(1).text().trim(),
        examRoll: $('table#customers')
            .find('tr').eq(1)
            .find('td').eq(1).text().trim(),
        result: $('table#customers')
            .find('tr').eq(3)
            .find('td').eq(1).text().trim(),
        subjects: {}
    };

    // Find the table containing the course-wise grades
    const resultTable = $('#customers').last();

    // Iterate over each row in the table (excluding the header row)
    resultTable.find('tr').each((index, element) => {
        if (index > 0) { // Skip the header row
            const courseCode = $(element).find('td').eq(0).text().trim();
            const grade = $(element).find('td').eq(1).text().trim();

            // Add course and grade to the student's subject list only if not empty
            if (courseCode && grade) {
                studentInfo.subjects[courseCode] = grade;
            }
        }
    });

    return studentInfo;
}

// Function to process the gathered HTML results and save to a JSON file
async function processResults(startRegNo, count, tempFile, outputFile) {
    // Read the raw HTML content from the temporary file
    const rawHtmlData = fs.readFileSync(tempFile, 'utf-8');

    const studentInfoArray = [];

    // Initialize the progress bar for processing
    const progressBar = new cliProgress.SingleBar({
        format: 'Processing [{bar}] {percentage}% | {value}/{total} Students',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
    }, cliProgress.Presets.shades_classic);

    // Start the progress bar
    progressBar.start(count, 0);

    // Split the raw HTML data into individual student sections
    const studentsHtml = rawHtmlData.split('<student').filter(Boolean).map(student => `<student${student}`);

    // Extract student info from each student’s HTML
    for (const studentHtml of studentsHtml) {
        const regNoMatch = studentHtml.match(/regNo="(\d+)"/);
        if (regNoMatch) {
            const regNo = regNoMatch[1];
            const studentInfo = extractStudentInfo(studentHtml, regNo);

            // Only add to results if there is a valid student info (non-null)
            if (Object.keys(studentInfo.subjects).length > 0) {
                studentInfoArray.push(studentInfo);
            }

            // Update the progress bar on each iteration
            progressBar.increment();
        }
    }

    // Stop the progress bar
    progressBar.stop();

    // Save the results to a JSON file
    if (studentInfoArray.length > 0) {
        fs.writeFileSync(outputFile, JSON.stringify(studentInfoArray, null, 2), 'utf-8');
        console.log(`Results saved to ${outputFile}`);
    } else {
        console.log('No results found to save.');
    }

    // Clean up: Delete the temporary file
    fs.unlinkSync(tempFile);
}

// Fetch results for 10 students starting from a specific registration number
const tempFile = 'temp_results3.html'; // Temporary file to store HTML responses
const outputFile = 'student_results.json'; // Final JSON file to store student info

fetchAllResults(19211221210, 50, tempFile)
    .then(() => processResults(19211221210, 50, tempFile, outputFile));
