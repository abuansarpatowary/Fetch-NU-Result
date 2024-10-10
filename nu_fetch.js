const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const ProgressBar = require("progress");

// Function to fetch the result of a student by registration number
async function fetchResult(regNo) {
  const url = `http://result.nu.ac.bd/results_latest/result_show.php?reg_no=${regNo}&exm_code=Bachelor%20Degree%20(Honours)%203rd%20Year&sub_code=1&exm_year=2022`;

  try {
    // Fetch the HTML
    const { data } = await axios.get(url);

    // Load the HTML into cheerio
    const $ = cheerio.load(data);

    // Check if the response contains valid data (e.g., presence of the results table)
    const resultTable = $("#customers");

    // Check if resultTable has data
    if (resultTable.length === 0) {
      // console.log(`No results found for Reg No: ${regNo}`);
      return null; // Skip this entry
    }

    // Initialize an object to store student data
    const studentResult = {
      regNO: regNo,
      name: resultTable.find("tr").eq(0).find("b").text().trim() || "N/A", // Extract student name
      "roll": resultTable.find("tr").eq(1).find("td").text().trim().replace(/^Exam\. Roll\s*/, "") || "N/A",
      subjects: {},
    };

    // Iterate over each row in the course grade table
    const gradesTable = $("table#customers").last(); // Find the last customers table
    gradesTable.find("tr").each((index, element) => {
      if (index > 0) {
        // Skip the header row
        const courseCode = $(element).find("td").eq(0).text().trim();
        const grade = $(element).find("td").eq(1).text().trim();

        // Add course and grade to the student's subject list
        if (courseCode && grade) {
          studentResult.subjects[courseCode] = grade;
        }
      }
    });

    return studentResult;
  } catch (error) {
    console.error(`Error fetching result for Reg No: ${regNo}`, error);
    return null; // Return null on error
  }
}

// Function to fetch results for a range of students
async function fetchResults(startRegNo, count) {
  const results = [];
  const bar = new ProgressBar(":current/:total [:bar] :percent", {
    total: count,
    width: 40,
    incomplete: " ",
    complete: "=",
  });

  for (let i = 0; i < count; i++) {
    const regNo = startRegNo + i;
    const result = await fetchResult(regNo);

    if (result) {
      results.push(result);
    }

    // Update the progress bar
    bar.tick();

    // Delay to avoid overwhelming the server (optional)
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Save results to a JSON file
  fs.writeFileSync(
    "student_result_islamic_studies.json",
    JSON.stringify(results, null, 2),
    "utf-8"
  );
  console.log("\nResults saved to student_results.json");
}

// Fetch results for 100 students starting from a specific registration number
fetchResults(19218221651, 30);
