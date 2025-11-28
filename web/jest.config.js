const nextJest = require('next/jest')
const createJestConfig = nextJest({ dir: './' })
const customJestConfig = {
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    testEnvironment: 'jest-environment-jsdom',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        'react-markdown': '<rootDir>/mocks/react-markdown.js',
        'remark-gfm': '<rootDir>/mocks/remark-gfm.js'
    },
    transformIgnorePatterns: [
        '/node_modules/(?!react-markdown|vfile|vfile-message|unist-util-stringify-position|universal-user-agent|unified|bail|is-plain-obj|trough|remark-parse|mdast-util-from-markdown|mdast-util-to-string|micromark|decode-named-character-reference|character-entities|property-information|hast-util-whitespace|space-separated-tokens|comma-separated-tokens|pretty-bytes|ccount|mdast-util-to-markdown|mdast-util-to-hast|mdast-util-definitions|mdast-util-find-and-replace|mdast-util-gfm|micromark-extension-gfm|remark-gfm|remark-rehype|hast-util-to-jsx-runtime|unist-util-visit|unist-util-is)'
    ]
}
module.exports = createJestConfig(customJestConfig)