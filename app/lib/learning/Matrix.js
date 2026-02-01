"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Matrix = void 0;
/**
 * Matrix Math Library for Neural Network
 * Implements core linear algebra operations needed for the MLP
 */
class Matrix {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.data = Array(rows).fill(0).map(() => Array(cols).fill(0));
    }
    /**
     * Create a matrix from a 1D array
     */
    static fromArray(arr) {
        const m = new Matrix(arr.length, 1);
        for (let i = 0; i < arr.length; i++) {
            m.data[i][0] = arr[i];
        }
        return m;
    }
    /**
     * Convert matrix to 1D array
     */
    toArray() {
        const arr = [];
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                arr.push(this.data[i][j]);
            }
        }
        return arr;
    }
    /**
     * Randomize values between -1 and 1
     */
    randomize() {
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                this.data[i][j] = Math.random() * 2 - 1;
            }
        }
    }
    /**
     * Add a scalar or another matrix element-wise
     */
    add(n) {
        if (n instanceof Matrix) {
            if (this.rows !== n.rows || this.cols !== n.cols) {
                console.error('Columns and Rows of A must match Columns and Rows of B.');
                return;
            }
            for (let i = 0; i < this.rows; i++) {
                for (let j = 0; j < this.cols; j++) {
                    this.data[i][j] += n.data[i][j];
                }
            }
        }
        else {
            for (let i = 0; i < this.rows; i++) {
                for (let j = 0; j < this.cols; j++) {
                    this.data[i][j] += n;
                }
            }
        }
    }
    /**
     * Static method to subtract two matrices (a - b)
     */
    static subtract(a, b) {
        if (a.rows !== b.rows || a.cols !== b.cols) {
            throw new Error('Columns and Rows of A must match Columns and Rows of B.');
        }
        const result = new Matrix(a.rows, a.cols);
        for (let i = 0; i < result.rows; i++) {
            for (let j = 0; j < result.cols; j++) {
                result.data[i][j] = a.data[i][j] - b.data[i][j];
            }
        }
        return result;
    }
    /**
     * Matrix Product (Dot Product)
     */
    static multiply(a, b) {
        if (a.cols !== b.rows) {
            throw new Error('Columns of A must match rows of B.');
        }
        const result = new Matrix(a.rows, b.cols);
        for (let i = 0; i < result.rows; i++) {
            for (let j = 0; j < result.cols; j++) {
                let sum = 0;
                for (let k = 0; k < a.cols; k++) {
                    sum += a.data[i][k] * b.data[k][j];
                }
                result.data[i][j] = sum;
            }
        }
        return result;
    }
    /**
     * Scalar multiplication (Hadamard product if n is Matrix)
     */
    multiply(n) {
        if (n instanceof Matrix) {
            if (this.rows !== n.rows || this.cols !== n.cols) {
                console.error('Columns and Rows of A must match Columns and Rows of B.');
                return;
            }
            for (let i = 0; i < this.rows; i++) {
                for (let j = 0; j < this.cols; j++) {
                    this.data[i][j] *= n.data[i][j];
                }
            }
        }
        else {
            for (let i = 0; i < this.rows; i++) {
                for (let j = 0; j < this.cols; j++) {
                    this.data[i][j] *= n;
                }
            }
        }
    }
    /**
     * Apply a function to every element
     */
    map(func) {
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                const val = this.data[i][j];
                this.data[i][j] = func(val, i, j);
            }
        }
    }
    /**
     * Static map: Return a new matrix after applying function
     */
    static map(matrix, func) {
        const result = new Matrix(matrix.rows, matrix.cols);
        for (let i = 0; i < matrix.rows; i++) {
            for (let j = 0; j < matrix.cols; j++) {
                const val = matrix.data[i][j];
                result.data[i][j] = func(val);
            }
        }
        return result;
    }
    /**
     * Transpose the matrix
     */
    static transpose(matrix) {
        const result = new Matrix(matrix.cols, matrix.rows);
        for (let i = 0; i < matrix.rows; i++) {
            for (let j = 0; j < matrix.cols; j++) {
                result.data[j][i] = matrix.data[i][j];
            }
        }
        return result;
    }
    /**
     * Print matrix to console
     */
    print() {
        console.table(this.data);
    }
}
exports.Matrix = Matrix;
