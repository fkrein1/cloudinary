// Require the necessary libraries
require('dotenv/config');
const fs = require('fs');
const path = require('path');
const csvWriter = require('csv-writer').createObjectCsvWriter;
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// Function to upload an image to Cloudinary and return the URL and filename
function uploadImage(imagePath, uploadConfig) {
  return new Promise((resolve, reject) => {
    const filename = path.basename(imagePath);
    cloudinary.uploader.upload(imagePath, uploadConfig, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve({ filename, url: result.url });
      }
    });
  });
}

// Function to upload images in batches and return a promise
function uploadImagesInBatches(imagePaths, uploadConfig, batchSize, timeout) {
  const batches = Math.ceil(imagePaths.length / batchSize);
  const batchPromises = [];

  for (let i = 0; i < batches; i++) {
    const startIndex = i * batchSize;
    const endIndex = startIndex + batchSize;
    const batchImagePaths = imagePaths.slice(startIndex, endIndex);
    const batchPromise = new Promise((resolve, reject) => {
      setTimeout(() => {
        Promise.all(
          batchImagePaths.map((file) => uploadImage(file, uploadConfig)),
        )
          .then((results) => {
            console.log(`Batch ${i + 1} uploaded successfully.`);
            resolve(results);
          })
          .catch((error) => {
            console.error(`Failed to upload batch ${i + 1}:`, error);
            reject(error);
          });
      }, timeout * i);
    });
    batchPromises.push(batchPromise);
  }

  return Promise.all(batchPromises).then((batchResults) => batchResults.flat());
}

// Get a list of all image files in the "./still" folder
const folderPath = './still';
const imageFiles = fs.readdirSync(folderPath).filter((file) => {
  const extension = path.extname(file).toLowerCase();
  return extension === '.jpg' || extension === '.jpeg' || extension === '.png';
});

// Array to store image URLs and filenames
const imageDetails = [];

// Create the csvWriter instance
const csvPath = './imageURLs.csv';
const csvWriterInstance = csvWriter({
  path: csvPath,
  header: [
    { id: 'filename', title: 'Filename' },
    { id: 'url', title: 'URL' },
  ],
});

// Upload images in batches and store their URLs and filenames
uploadImagesInBatches(
  imageFiles.map((file) => path.join(folderPath, file)),
  {},
  5,
  500,
)
  .then((results) => {
    imageDetails.push(...results);
    console.log('All images uploaded successfully.');

    // Create an array of record objects for all the images
    const records = imageDetails.map((details) => ({
      filename: details.filename,
      url: details.url,
    }));

    // Write the records to the CSV file
    csvWriterInstance
      .writeRecords(records)
      .then(() => {
        console.log(`Image details saved to ${csvPath}`);
      })
      .catch((error) => {
        console.error('Failed to save image details to CSV:', error);
      });
  })
  .catch((error) => {
    console.error('Failed to upload images:', error);
  });
