package com.platform.menuai.provider;

/**
 * Turns a photographed / PDF menu into structured items. The MVP uses a deterministic mock; a real
 * implementation would send the file to a vision-capable LLM with a JSON schema for {@link ExtractedItem}.
 */
public interface MenuExtractionProvider {

    String name();

    ExtractionResult extract(ExtractionInput input);
}
