"""No-model tests for exact lyric mapping and invalid worker output."""

import unittest

from align_words import remap_words


class MappingTests(unittest.TestCase):
    def test_exact_whitespace_and_repeated_words(self):
        words = [
            {"word": "go", "start": 0, "end": 0.2, "probability": 0.8},
            {"word": " go!", "start": 0.4, "end": 0.8, "probability": 0.3},
        ]
        result = remap_words(" go  go!", [" go  ", "go!"], words, 10)
        self.assertEqual("".join(word["text"] for word in result), " go  go!")
        self.assertEqual(result[1]["start_ms"], 10400)
        self.assertEqual(result[1]["confidence"], 0.3)

    def test_missing_text_is_rejected(self):
        with self.assertRaises(ValueError):
            remap_words(
                "hello world",
                ["hello ", "world"],
                [{"word": "hello", "start": 0, "end": 1}],
            )

    def test_mismatched_original_tokens_rejected(self):
        with self.assertRaises(ValueError):
            remap_words("hello", ["different"], [])

    def test_unicode_unknown_confidence(self):
        result = remap_words(
            "café", ["café"], [{"word": "café", "start": 0.2, "end": 0.4}]
        )
        self.assertEqual(result[0]["start_ms"], 200)
        self.assertIsNone(result[0]["confidence"])


if __name__ == "__main__":
    unittest.main()
