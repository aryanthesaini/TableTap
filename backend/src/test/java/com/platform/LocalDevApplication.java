package com.platform;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Runs the backend against a real, embedded PostgreSQL 16 — no Docker or local Postgres needed.
 * Data persists in {@code ./data/postgres} between runs (delete it to reset demo data).
 *
 * <pre>./run-local.sh</pre>
 */
public final class LocalDevApplication {

    public static void main(String[] args) throws Exception {
        Path dataDir = Path.of(System.getProperty("tabletap.pgdata", "data/postgres")).toAbsolutePath();
        Files.createDirectories(dataDir);
        int port = Integer.parseInt(System.getProperty("tabletap.pgport", "54329"));
        EmbeddedPostgres postgres = EmbeddedPostgres.builder()
                .setDataDirectory(dataDir)
                .setCleanDataDirectory(false)
                .setPort(port)
                .start();
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try {
                postgres.close();
            } catch (Exception ignored) {
                // shutting down
            }
        }));
        System.setProperty("spring.datasource.url", "jdbc:postgresql://localhost:" + port + "/postgres");
        System.setProperty("spring.datasource.username", "postgres");
        System.setProperty("spring.datasource.password", "postgres");
        TableTapApplication.main(args);
    }
}
