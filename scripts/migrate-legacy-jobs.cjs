
const fs = require("fs");
const path = require("path");

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
  throw new Error("Service Account JSON tidak ditemukan.");
}

const serviceAccount = require(path.resolve(serviceAccountPath));

if (serviceAccount.project_id !== "jobboard-mini") {
  throw new Error("Service Account bukan milik project jobboard-mini.");
}

const app = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore(app);

const ADMIN_UID = "LnV1yFO8wufLZAJIKbvNeVVNpxy1";

const APPLY_CHANGES = process.argv.includes("--apply");

async function migrateJobs() {
  console.log("Membaca koleksi jobs...");

  const snapshot = await db.collection("jobs").get();

  const jobsToMigrate = snapshot.docs.filter((document) => {
    const data = document.data();
    return !data.employerId;
  });

  console.log(`Total dokumen: ${snapshot.size}`);
  console.log(`Belum memiliki employerId: ${jobsToMigrate.length}`);
  console.log(
    `Sudah memiliki employerId: ${snapshot.size - jobsToMigrate.length}`
  );

  if (jobsToMigrate.length === 0) {
    console.log("Tidak ada dokumen yang perlu dimigrasikan.");
    return;
  }

  // Backup seluruh dokumen sebelum perubahan.
  const backupDir = path.join(__dirname, "..", "backups");

  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const backupPath = path.join(
    backupDir,
    `jobs-backup-${timestamp}.json`
  );

  const backupData = snapshot.docs.map((document) => ({
    id: document.id,
    data: document.data(),
  }));

  fs.writeFileSync(
    backupPath,
    JSON.stringify(backupData, null, 2),
    "utf8"
  );

  console.log(`Backup tersimpan: ${backupPath}`);

  if (!APPLY_CHANGES) {
    console.log("\nSIMULASI SELESAI.");
    console.log("Belum ada data Firestore yang diubah.");
    console.log("Periksa hasil sebelum menjalankan migrasi sebenarnya.");
    return;
  }

  // Update hanya dokumen yang belum memiliki employerId.
  for (let i = 0; i < jobsToMigrate.length; i += 450) {
    const batch = db.batch();

    const chunk = jobsToMigrate.slice(i, i + 450);

    chunk.forEach((document) => {
      batch.update(document.ref, {
        employerId: ADMIN_UID,
      });
    });

    await batch.commit();

    console.log(
      `Berhasil memperbarui ${Math.min(
        i + 450,
        jobsToMigrate.length
      )} dari ${jobsToMigrate.length} dokumen.`
    );
  }

  console.log("\nMIGRASI BERHASIL.");
}

migrateJobs()
  .catch((error) => {
    console.error("Migrasi gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await app.delete();
  });
