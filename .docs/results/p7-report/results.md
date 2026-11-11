# P7 results

Written by `npm run report -w @breadit/eval` from the results of the twelve P7 runs. Do not edit: change the results and run it again.

## tuning: Values chosen on the validation split (the highest NDCG@10, a tie to the smaller value)

| Dataset | Method | Parameter | Value | Validation NDCG@10 |
| --- | --- | --- | --- | ---: |
| syn-W0-M | H | alpha/beta | 32/512 | 0.027 |
| syn-W1-M | H | alpha/beta | 256/1024 | 0.029 |
| syn-W2L-M | H | alpha/beta | 1024/512 | 0.032 |
| syn-W2M-M | BL2t | ageWeight | 0.125 | 0.012 |
| syn-W2M-M | BL4 | divisor | 720000 | 0.012 |
| syn-W2M-M | BL5 | gravity | 0.6 | 0.010 |
| syn-W2M-M | BL6 | alpha | 16 | 0.018 |
| syn-W2M-M | H | alpha/beta | 1024/1024 | 0.048 |
| syn-W2H-M | H | alpha/beta | 1024/1024 | 0.085 |
| digg2009 | BL2t | ageWeight | 4 | 0.097 |
| digg2009 | BL4 | divisor | 45000 | 0.244 |
| digg2009 | BL5 | gravity | 1.5 | 0.249 |
| digg2009 | BL6 | alpha | 1024 | 0.094 |
| digg2009 | H | alpha/beta | 1024/0 | 0.093 |

## leftout: Test users and users left out of the pool, by history group

| Dataset | Group | Test users | Left out |
| --- | --- | ---: | ---: |
| syn-W2M-M | 0 | 64 | 5 |
| syn-W2M-M | 1-4 | 126 | 11 |
| syn-W2M-M | 0-4 | 190 | 16 |
| syn-W2M-M | 5-19 | 192 | 15 |
| syn-W2M-M | 20+ | 208 | 18 |
| syn-W2M-M | all | 590 | 49 |
| digg2009 | 0 | 7141 | 503 |
| digg2009 | 1-4 | 14887 | 881 |
| digg2009 | 0-4 | 22028 | 1384 |
| digg2009 | 5-19 | 21818 | 1031 |
| digg2009 | 20+ | 24274 | 1132 |
| digg2009 | all | 68120 | 3547 |

## e1: All methods on the test split, all users (K = 10)

| Method | syn-W2M-M NDCG@10 | syn-W2M-M Recall@10 | syn-W2M-M Coverage@10 | digg2009 NDCG@10 | digg2009 Recall@10 | digg2009 Coverage@10 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| BL0 | 0.005 | 0.009 | 0.447 | 0.026 | 0.050 | 0.835 |
| BL1 | 0.003 | 0.007 | 0.423 | 0.025 | 0.050 | 0.433 |
| BL2 | 0.009 | 0.017 | 0.250 | 0.024 | 0.050 | 0.144 |
| BL2t | 0.011 | 0.024 | 0.042 | 0.027 | 0.059 | 0.137 |
| BL3 | 0.007 | 0.013 | 0.013 | 0.023 | 0.050 | 0.145 |
| BL4 | 0.009 | 0.022 | 0.021 | 0.197 | 0.333 | 0.218 |
| BL5 | 0.009 | 0.020 | 0.052 | 0.199 | 0.337 | 0.192 |
| BL6 | 0.011 | 0.022 | 0.357 | 0.025 | 0.053 | 0.526 |
| H | 0.054 | 0.094 | 0.210 | 0.024 | 0.050 | 0.144 |

## e2: H against BL2 by history group, NDCG@10 (family F1, Holm-adjusted p)

| Dataset | Group | Users | BL2 | H | Gain | CI low | CI high | p (Holm) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| syn-W2M-M | 0 | 59 | 0.017 | 0.044 | 0.027 | -0.029 | 0.090 | 0.879 |
| syn-W2M-M | 1-4 | 115 | 0.009 | 0.030 | 0.021 | -0.003 | 0.050 | 0.844 |
| syn-W2M-M | 0-4 | 174 | 0.012 | 0.035 | 0.023 | -0.002 | 0.051 | 0.680 |
| syn-W2M-M | 5-19 | 177 | 0.013 | 0.043 | 0.031 | 0.003 | 0.059 | 0.378 |
| syn-W2M-M | 20+ | 190 | 0.003 | 0.082 | 0.078 | 0.048 | 0.112 | 0.002 |
| digg2009 | 0 | 6638 | 0.030 | 0.031 | 0.000 | 0.000 | 0.000 | 0.192 |
| digg2009 | 1-4 | 14006 | 0.029 | 0.029 | 0.000 | 0.000 | 0.000 | 1.000 |
| digg2009 | 0-4 | 20644 | 0.029 | 0.029 | 0.000 | 0.000 | 0.000 | 0.335 |
| digg2009 | 5-19 | 20787 | 0.021 | 0.021 | 0.000 | 0.000 | 0.000 | 1.000 |
| digg2009 | 20+ | 23142 | 0.021 | 0.021 | 0.000 | 0.000 | 0.000 | 1.000 |

## e3: Gain of H over BL2 by social density (number of followees), NDCG@10

| Dataset | Followees | Users | Gain | CI low | CI high |
| --- | --- | ---: | ---: | ---: | ---: |
| syn-W2L-M | 0 | 278 | 0.032 | 0.013 | 0.054 |
| syn-W2L-M | 1-4 | 1 | 0.000 | 0.000 | 0.000 |
| syn-W2L-M | 5-19 | 161 | 0.051 | 0.024 | 0.081 |
| syn-W2L-M | 20+ | 102 | 0.020 | -0.013 | 0.057 |
| syn-W2M-M | 0 | 280 | 0.044 | 0.021 | 0.068 |
| syn-W2M-M | 1-4 | 1 | 0.000 | 0.000 | 0.000 |
| syn-W2M-M | 5-19 | 159 | 0.056 | 0.024 | 0.092 |
| syn-W2M-M | 20+ | 101 | 0.030 | -0.002 | 0.067 |
| syn-W2H-M | 0 | 276 | 0.076 | 0.052 | 0.101 |
| syn-W2H-M | 1-4 | 1 | 0.000 | 0.000 | 0.000 |
| syn-W2H-M | 5-19 | 163 | 0.079 | 0.045 | 0.117 |
| syn-W2H-M | 20+ | 98 | 0.071 | 0.030 | 0.116 |
| digg2009 | 0 | 27824 | 0.000 | 0.000 | 0.000 |
| digg2009 | 1-4 | 20292 | 0.000 | 0.000 | 0.000 |
| digg2009 | 5-19 | 10563 | 0.000 | 0.000 | 0.000 |
| digg2009 | 20+ | 5894 | 0.000 | 0.000 | 0.000 |

## e4: Terms of H and the prior strength m, NDCG@10 (gain over BL2, all users)

| Dataset | Variant | NDCG@10 all | NDCG@10 0-4 | Gain over BL2 |
| --- | --- | ---: | ---: | ---: |
| syn-W2M-M | BL2 | 0.009 | 0.012 |  |
| syn-W2M-M | H (m = 5) | 0.054 | 0.035 | 0.045 |
| syn-W2M-M | H-follow | 0.016 | 0.019 | 0.007 |
| syn-W2M-M | H-comm | 0.052 | 0.024 | 0.043 |
| syn-W2M-M | H-noauthor | 0.055 | 0.031 | 0.046 |
| syn-W2M-M | H-noengager | 0.051 | 0.026 | 0.042 |
| syn-W2M-M | H (m = 0) | 0.056 | 0.027 | 0.047 |
| syn-W2M-M | H (m = 2) | 0.060 | 0.043 | 0.051 |
| syn-W2M-M | H (m = 10) | 0.050 | 0.034 | 0.041 |
| digg2009 | BL2 | 0.024 | 0.029 |  |
| digg2009 | H (m = 5) | 0.024 | 0.029 | 0.000 |
| digg2009 | H-follow | 0.024 | 0.029 | 0.000 |
| digg2009 | H-noauthor | 0.024 | 0.029 | 0.000 |
| digg2009 | H-noengager | 0.024 | 0.029 | 0.000 |
| digg2009 | H (m = 0) | 0.024 | 0.029 | 0.000 |
| digg2009 | H (m = 2) | 0.024 | 0.029 | 0.000 |
| digg2009 | H (m = 10) | 0.024 | 0.029 | 0.000 |

## e5: Gain over BL2 in each world, NDCG@10 (K = 10, all users, no p-value). The H0 gate is the H-follow row

| Run | Dataset | Users | Gain | CI low | CI high |
| --- | --- | ---: | ---: | ---: | ---: |
| own tuning | syn-W0-M | 542 | 0.012 | 0.000 | 0.024 |
| own tuning | syn-W1-M | 540 | 0.029 | 0.017 | 0.041 |
| own tuning | syn-W2L-M | 542 | 0.035 | 0.021 | 0.051 |
| own tuning | syn-W2M-M | 541 | 0.045 | 0.028 | 0.062 |
| own tuning | syn-W2H-M | 538 | 0.076 | 0.057 | 0.095 |
| H0 gate: H-follow (alpha of syn-W2M-M) | syn-W0-M | 542 | 0.001 | -0.004 | 0.006 |
| H on W0, values of syn-W2M-M (topic signal) | syn-W0-M | 542 | 0.011 | -0.001 | 0.023 |
| timestamps shuffled | syn-W2M-M-shuffled | 542 | 0.042 | 0.026 | 0.059 |

## e6: NDCG@10, all users, with the normal and the reversed tie-break

| Method | syn-W2M-M normal | syn-W2M-M reversed ties | digg2009 normal | digg2009 reversed ties |
| --- | ---: | ---: | ---: | ---: |
| BL0 | 0.005 | 0.005 | 0.026 | 0.026 |
| BL1 | 0.003 | 0.003 | 0.025 | 0.025 |
| BL2 | 0.009 | 0.009 | 0.024 | 0.024 |
| BL2t | 0.011 | 0.011 | 0.027 | 0.027 |
| BL3 | 0.007 | 0.007 | 0.023 | 0.023 |
| BL4 | 0.009 | 0.008 | 0.197 | 0.196 |
| BL5 | 0.009 | 0.010 | 0.199 | 0.199 |
| BL6 | 0.011 | 0.011 | 0.025 | 0.025 |
| H | 0.054 | 0.054 | 0.024 | 0.024 |

## e8: NDCG@10 on syn-W2M-M with the normal and the larger pool

| Method | Normal, all | Normal, 0-4 | Larger pool, all | Larger pool, 0-4 |
| --- | ---: | ---: | ---: | ---: |
| BL2 | 0.009 | 0.012 | 0.008 | 0.011 |
| BL6 | 0.011 | 0.017 | 0.010 | 0.016 |
| H | 0.054 | 0.035 | 0.048 | 0.032 |

## Macros

| Macro | Value | Cell |
| --- | ---: | --- |
| \eEightWTwoMNdcgBLTwoTenAllValue | 0.008 | p7-e8-pool/summary.csv syn-W2M-M|test|BL2|10|all ndcg |
| \eEightWTwoMNdcgHTenAllValue | 0.048 | p7-e8-pool/summary.csv syn-W2M-M|test|H|10|all ndcg |
| \eFiveWOneNdcgTenAllCiLow | 0.017 | p7-e5-worlds/compare.csv syn-W1-M|none|H|BL2|10|all ci_low |
| \eFiveWOneNdcgTenAllGain | 0.029 | p7-e5-worlds/compare.csv syn-W1-M|none|H|BL2|10|all mean_diff |
| \eFiveWTwoHNdcgTenAllCiLow | 0.057 | p7-e5-worlds/compare.csv syn-W2H-M|none|H|BL2|10|all ci_low |
| \eFiveWTwoHNdcgTenAllGain | 0.076 | p7-e5-worlds/compare.csv syn-W2H-M|none|H|BL2|10|all mean_diff |
| \eFiveWTwoLNdcgTenAllCiLow | 0.021 | p7-e5-worlds/compare.csv syn-W2L-M|none|H|BL2|10|all ci_low |
| \eFiveWTwoLNdcgTenAllGain | 0.035 | p7-e5-worlds/compare.csv syn-W2L-M|none|H|BL2|10|all mean_diff |
| \eFiveWTwoMNdcgTenAllCiLow | 0.028 | p7-e5-worlds/compare.csv syn-W2M-M|none|H|BL2|10|all ci_low |
| \eFiveWTwoMNdcgTenAllGain | 0.045 | p7-e5-worlds/compare.csv syn-W2M-M|none|H|BL2|10|all mean_diff |
| \eFiveWTwoMShuffledNdcgTenAllCiLow | 0.026 | p7-e5-shuffle/compare.csv syn-W2M-M-shuffled|none|H|BL2|10|all ci_low |
| \eFiveWTwoMShuffledNdcgTenAllGain | 0.042 | p7-e5-shuffle/compare.csv syn-W2M-M-shuffled|none|H|BL2|10|all mean_diff |
| \eFiveWZeroNdcgTenAllCiLow | 0.000 | p7-e5-worlds/compare.csv syn-W0-M|none|H|BL2|10|all ci_low |
| \eFiveWZeroNdcgTenAllGain | 0.012 | p7-e5-worlds/compare.csv syn-W0-M|none|H|BL2|10|all mean_diff |
| \eFourDiggNdcgHFollowTenAllGain | 0.000 | p7-e4-terms/compare.csv digg2009|none|H-follow|BL2|10|all mean_diff |
| \eFourDiggNdcgHMTenTenAllGain | 0.000 | p7-e4-m10/compare.csv digg2009|none|H|BL2|10|all mean_diff |
| \eFourDiggNdcgHMTwoTenAllGain | 0.000 | p7-e4-m2/compare.csv digg2009|none|H|BL2|10|all mean_diff |
| \eFourDiggNdcgHMZeroTenAllGain | 0.000 | p7-e4-m0/compare.csv digg2009|none|H|BL2|10|all mean_diff |
| \eFourDiggNdcgHNoauthorTenAllGain | 0.000 | p7-e4-terms/compare.csv digg2009|none|H-noauthor|BL2|10|all mean_diff |
| \eFourDiggNdcgHNoengagerTenAllGain | 0.000 | p7-e4-terms/compare.csv digg2009|none|H-noengager|BL2|10|all mean_diff |
| \eFourDiggNdcgHTenAllGain | 0.000 | p7-e4-terms/compare.csv digg2009|none|H|BL2|10|all mean_diff |
| \eFourWTwoMNdcgHCommTenAllGain | 0.043 | p7-e4-terms/compare.csv syn-W2M-M|none|H-comm|BL2|10|all mean_diff |
| \eFourWTwoMNdcgHFollowTenAllGain | 0.007 | p7-e4-terms/compare.csv syn-W2M-M|none|H-follow|BL2|10|all mean_diff |
| \eFourWTwoMNdcgHMTenTenAllGain | 0.041 | p7-e4-m10/compare.csv syn-W2M-M|none|H|BL2|10|all mean_diff |
| \eFourWTwoMNdcgHMTwoTenAllGain | 0.051 | p7-e4-m2/compare.csv syn-W2M-M|none|H|BL2|10|all mean_diff |
| \eFourWTwoMNdcgHMZeroTenAllGain | 0.047 | p7-e4-m0/compare.csv syn-W2M-M|none|H|BL2|10|all mean_diff |
| \eFourWTwoMNdcgHNoauthorTenAllGain | 0.046 | p7-e4-terms/compare.csv syn-W2M-M|none|H-noauthor|BL2|10|all mean_diff |
| \eFourWTwoMNdcgHNoengagerTenAllGain | 0.042 | p7-e4-terms/compare.csv syn-W2M-M|none|H-noengager|BL2|10|all mean_diff |
| \eFourWTwoMNdcgHTenAllGain | 0.045 | p7-e4-terms/compare.csv syn-W2M-M|none|H|BL2|10|all mean_diff |
| \eOneDiggCovBLTwoTenAllValue | 0.144 | p7-main/coverage.csv digg2009|test|BL2|10 coverage |
| \eOneDiggCovHTenAllValue | 0.144 | p7-main/coverage.csv digg2009|test|H|10 coverage |
| \eOneDiggLeftOutAllN | 3547 | p7-main/leftout.csv digg2009|test|all n_left_out |
| \eOneDiggNdcgBLTwoTenAllValue | 0.024 | p7-main/summary.csv digg2009|test|BL2|10|all ndcg |
| \eOneDiggNdcgHTenAllValue | 0.024 | p7-main/summary.csv digg2009|test|H|10|all ndcg |
| \eOneDiggTestUsersAllN | 68120 | p7-main/leftout.csv digg2009|test|all n_test_users |
| \eOneWTwoMCovBLTwoTenAllValue | 0.250 | p7-main/coverage.csv syn-W2M-M|test|BL2|10 coverage |
| \eOneWTwoMCovHTenAllValue | 0.210 | p7-main/coverage.csv syn-W2M-M|test|H|10 coverage |
| \eOneWTwoMLeftOutAllN | 49 | p7-main/leftout.csv syn-W2M-M|test|all n_left_out |
| \eOneWTwoMNdcgBLTwoTenAllValue | 0.009 | p7-main/summary.csv syn-W2M-M|test|BL2|10|all ndcg |
| \eOneWTwoMNdcgHTenAllValue | 0.054 | p7-main/summary.csv syn-W2M-M|test|H|10|all ndcg |
| \eOneWTwoMTestUsersAllN | 590 | p7-main/leftout.csv syn-W2M-M|test|all n_test_users |
| \eSixDiggNdcgBLTwoTenAllValue | 0.024 | p7-e6-ties/summary.csv digg2009|test|BL2|10|all ndcg |
| \eSixDiggNdcgHTenAllValue | 0.024 | p7-e6-ties/summary.csv digg2009|test|H|10|all ndcg |
| \eSixWTwoMNdcgBLTwoTenAllValue | 0.009 | p7-e6-ties/summary.csv syn-W2M-M|test|BL2|10|all ndcg |
| \eSixWTwoMNdcgHTenAllValue | 0.054 | p7-e6-ties/summary.csv syn-W2M-M|test|H|10|all ndcg |
| \eThreeDiggNdcgTenTwentyPlusGain | 0.000 | p7-main/density.csv digg2009|20+|H|BL2 mean_diff |
| \eThreeDiggNdcgTenZeroGain | 0.000 | p7-main/density.csv digg2009|0|H|BL2 mean_diff |
| \eThreeWTwoHNdcgTenTwentyPlusGain | 0.071 | p7-e5-worlds/density.csv syn-W2H-M|20+|H|BL2 mean_diff |
| \eThreeWTwoHNdcgTenZeroGain | 0.076 | p7-e5-worlds/density.csv syn-W2H-M|0|H|BL2 mean_diff |
| \eThreeWTwoLNdcgTenTwentyPlusGain | 0.020 | p7-e5-worlds/density.csv syn-W2L-M|20+|H|BL2 mean_diff |
| \eThreeWTwoLNdcgTenZeroGain | 0.032 | p7-e5-worlds/density.csv syn-W2L-M|0|H|BL2 mean_diff |
| \eThreeWTwoMNdcgTenTwentyPlusGain | 0.030 | p7-e5-worlds/density.csv syn-W2M-M|20+|H|BL2 mean_diff |
| \eThreeWTwoMNdcgTenZeroGain | 0.044 | p7-e5-worlds/density.csv syn-W2M-M|0|H|BL2 mean_diff |
| \eTwoDiggNdcgTenOneFourGain | 0.000 | p7-main/compare.csv digg2009|F1|H|BL2|10|1-4 mean_diff |
| \eTwoDiggNdcgTenZeroFourCiHigh | 0.000 | p7-main/compare.csv digg2009|F1|H|BL2|10|0-4 ci_high |
| \eTwoDiggNdcgTenZeroFourCiLow | 0.000 | p7-main/compare.csv digg2009|F1|H|BL2|10|0-4 ci_low |
| \eTwoDiggNdcgTenZeroFourGain | 0.000 | p7-main/compare.csv digg2009|F1|H|BL2|10|0-4 mean_diff |
| \eTwoDiggNdcgTenZeroFourN | 20644 | p7-main/compare.csv digg2009|F1|H|BL2|10|0-4 n |
| \eTwoDiggNdcgTenZeroFourPHolm | 0.335 | p7-main/compare.csv digg2009|F1|H|BL2|10|0-4 p_holm |
| \eTwoDiggNdcgTenZeroGain | 0.000 | p7-main/compare.csv digg2009|F1|H|BL2|10|0 mean_diff |
| \eTwoWTwoMNdcgTenOneFourGain | 0.021 | p7-main/compare.csv syn-W2M-M|F1|H|BL2|10|1-4 mean_diff |
| \eTwoWTwoMNdcgTenZeroFourCiHigh | 0.051 | p7-main/compare.csv syn-W2M-M|F1|H|BL2|10|0-4 ci_high |
| \eTwoWTwoMNdcgTenZeroFourCiLow | -0.002 | p7-main/compare.csv syn-W2M-M|F1|H|BL2|10|0-4 ci_low |
| \eTwoWTwoMNdcgTenZeroFourGain | 0.023 | p7-main/compare.csv syn-W2M-M|F1|H|BL2|10|0-4 mean_diff |
| \eTwoWTwoMNdcgTenZeroFourN | 174 | p7-main/compare.csv syn-W2M-M|F1|H|BL2|10|0-4 n |
| \eTwoWTwoMNdcgTenZeroFourPHolm | 0.680 | p7-main/compare.csv syn-W2M-M|F1|H|BL2|10|0-4 p_holm |
| \eTwoWTwoMNdcgTenZeroGain | 0.027 | p7-main/compare.csv syn-W2M-M|F1|H|BL2|10|0 mean_diff |
| \hZeroWZeroNdcgHFollowTenAllCiHigh | 0.006 | p7-h0/compare.csv syn-W0-M|none|H-follow|BL2|10|all ci_high |
| \hZeroWZeroNdcgHFollowTenAllCiLow | -0.004 | p7-h0/compare.csv syn-W0-M|none|H-follow|BL2|10|all ci_low |
| \hZeroWZeroNdcgHFollowTenAllGain | 0.001 | p7-h0/compare.csv syn-W0-M|none|H-follow|BL2|10|all mean_diff |
