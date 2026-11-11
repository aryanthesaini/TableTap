# ---- build ----
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package && cp target/tabletap-backend-*.jar /app.jar

# ---- run ----
FROM eclipse-temurin:21-jre
RUN useradd --system --uid 1001 app && mkdir -p /data/uploads && chown app /data/uploads
USER app
WORKDIR /app
COPY --from=build /app.jar app.jar
ENV STORAGE_LOCAL_ROOT=/data/uploads \
    JAVA_OPTS="-XX:MaxRAMPercentage=75"
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
