/**
 * Matrix Library for Carl Neural Network
 * Implements all linear algebra operations needed for forward/backward propagation
 * 
 * Based on "Make Your Own Neural Network" by Tariq Rashid
 * Optimized for TypeScript and server-side execution
 */

export class Matrix {
    public rows: number;
    public cols: number;
    public data: number[][];

    constructor(rows: number, cols: number) {
        this.rows = rows;
        this.cols = cols;
        // Initialize with zeros
        this.data = Array(rows).fill(null).map(() => Array(cols).fill(0));
    }

    /**
     * Create a copy of this matrix
     */
    copy(): Matrix {
        const result = new Matrix(this.rows, this.cols);
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                result.data[i][j] = this.data[i][j];
            }
        }
        return result;
    }

    /**
     * Create a matrix from a 1D array (column vector)
     */
    static fromArray(arr: number[]): Matrix {
        const m = new Matrix(arr.length, 1);
        for (let i = 0; i < arr.length; i++) {
            m.data[i][0] = arr[i];
        }
        return m;
    }

    /**
     * Convert matrix to flat array
     */
    toArray(): number[] {
        const arr: number[] = [];
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                arr.push(this.data[i][j]);
            }
        }
        return arr;
    }

    /**
     * Randomize all values using normal distribution
     * Following the book's recommendation: sample from normal distribution
     * with mean 0 and standard deviation = 1/sqrt(incoming_nodes)
     */
    randomize(incomingNodes?: number): void {
        const stddev = incomingNodes ? 1 / Math.sqrt(incomingNodes) : 1;
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                // Box-Muller transform for normal distribution
                const u1 = Math.random();
                const u2 = Math.random();
                const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
                this.data[i][j] = z * stddev;
            }
        }
    }

    /**
     * Element-wise addition (mutates this matrix)
     */
    add(n: number | Matrix): Matrix {
        if (n instanceof Matrix) {
            if (this.rows !== n.rows || this.cols !== n.cols) {
                throw new Error(`Matrix dimensions must match for addition: (${this.rows}x${this.cols}) vs (${n.rows}x${n.cols})`);
            }
            for (let i = 0; i < this.rows; i++) {
                for (let j = 0; j < this.cols; j++) {
                    this.data[i][j] += n.data[i][j];
                }
            }
        } else {
            for (let i = 0; i < this.rows; i++) {
                for (let j = 0; j < this.cols; j++) {
                    this.data[i][j] += n;
                }
            }
        }
        return this;
    }

    /**
     * Static subtraction: returns new matrix (a - b)
     */
    static subtract(a: Matrix, b: Matrix): Matrix {
        if (a.rows !== b.rows || a.cols !== b.cols) {
            throw new Error(`Matrix dimensions must match for subtraction: (${a.rows}x${a.cols}) vs (${b.rows}x${b.cols})`);
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
     * Matrix multiplication (dot product): returns new matrix
     * Result dimensions: (a.rows x b.cols)
     */
    static dot(a: Matrix, b: Matrix): Matrix {
        if (a.cols !== b.rows) {
            throw new Error(`Matrix multiplication dimension mismatch: (${a.rows}x${a.cols}) dot (${b.rows}x${b.cols})`);
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
     * Element-wise (Hadamard) multiplication or scalar multiplication (mutates this)
     */
    multiply(n: number | Matrix): Matrix {
        if (n instanceof Matrix) {
            if (this.rows !== n.rows || this.cols !== n.cols) {
                throw new Error(`Matrix dimensions must match for Hadamard product: (${this.rows}x${this.cols}) vs (${n.rows}x${n.cols})`);
            }
            for (let i = 0; i < this.rows; i++) {
                for (let j = 0; j < this.cols; j++) {
                    this.data[i][j] *= n.data[i][j];
                }
            }
        } else {
            for (let i = 0; i < this.rows; i++) {
                for (let j = 0; j < this.cols; j++) {
                    this.data[i][j] *= n;
                }
            }
        }
        return this;
    }

    /**
     * Static Hadamard (element-wise) product
     */
    static hadamard(a: Matrix, b: Matrix): Matrix {
        if (a.rows !== b.rows || a.cols !== b.cols) {
            throw new Error(`Matrix dimensions must match for Hadamard product`);
        }
        const result = new Matrix(a.rows, a.cols);
        for (let i = 0; i < a.rows; i++) {
            for (let j = 0; j < a.cols; j++) {
                result.data[i][j] = a.data[i][j] * b.data[i][j];
            }
        }
        return result;
    }

    /**
     * Apply function to every element (mutates this)
     */
    map(fn: (val: number, row: number, col: number) => number): Matrix {
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                this.data[i][j] = fn(this.data[i][j], i, j);
            }
        }
        return this;
    }

    /**
     * Static map: returns new matrix after applying function
     */
    static map(matrix: Matrix, fn: (val: number, row?: number, col?: number) => number): Matrix {
        const result = new Matrix(matrix.rows, matrix.cols);
        for (let i = 0; i < matrix.rows; i++) {
            for (let j = 0; j < matrix.cols; j++) {
                result.data[i][j] = fn(matrix.data[i][j], i, j);
            }
        }
        return result;
    }

    /**
     * Transpose matrix
     */
    static transpose(matrix: Matrix): Matrix {
        const result = new Matrix(matrix.cols, matrix.rows);
        for (let i = 0; i < matrix.rows; i++) {
            for (let j = 0; j < matrix.cols; j++) {
                result.data[j][i] = matrix.data[i][j];
            }
        }
        return result;
    }

    /**
     * Serialize to JSON-safe format
     */
    serialize(): number[][] {
        return this.data.map(row => [...row]);
    }

    /**
     * Deserialize from JSON
     */
    static deserialize(data: number[][]): Matrix {
        const rows = data.length;
        const cols = data[0]?.length || 0;
        const m = new Matrix(rows, cols);
        m.data = data.map(row => [...row]);
        return m;
    }

    /**
     * Debug print
     */
    print(label?: string): void {
        if (label) console.log(`\n${label}:`);
        console.table(this.data.map(row => row.map(v => v.toFixed(4))));
    }
}
