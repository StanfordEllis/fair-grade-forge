// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title FairGradeForge - Fair academic evaluation system with FHE encryption
/// @notice A smart contract for encrypted assignment submissions and grades
/// @dev Students submit encrypted answers, teachers decrypt after deadline and encrypt grades
contract FairGradeForge is SepoliaConfig {
    /// @notice Assignment structure
    struct Assignment {
        uint256 id;
        string title;
        string requirements;
        uint256 deadline;
        address teacher;
        uint256 submissionCount;
        bool isGrading;
    }

    /// @notice Student submission structure
    struct Submission {
        address student;
        euint32 encryptedAnswer; // Encrypted answer text (as euint32 for simplicity)
        uint256 timestamp;
        bool exists;
    }

    /// @notice Grade structure
    struct Grade {
        euint32 encryptedScore; // Encrypted score (0-100)
        uint256 timestamp;
        bool exists;
    }

    /// @notice Teacher address (deployer)
    address public teacher;

    /// @notice Mapping from assignment ID to Assignment
    mapping(uint256 => Assignment) public assignments;

    /// @notice Mapping from assignment ID to student address to Submission
    mapping(uint256 => mapping(address => Submission)) public submissions;

    /// @notice Mapping from assignment ID to student address to Grade
    mapping(uint256 => mapping(address => Grade)) public grades;

    /// @notice Total number of assignments
    uint256 public totalAssignments;

    /// @notice Event emitted when a new assignment is created
    event AssignmentCreated(
        uint256 indexed assignmentId,
        address indexed teacher,
        string title,
        uint256 deadline
    );

    /// @notice Event emitted when a student submits an assignment
    event SubmissionCreated(
        uint256 indexed assignmentId,
        address indexed student,
        uint256 timestamp
    );

    /// @notice Event emitted when a teacher grades a submission
    event GradeAssigned(
        uint256 indexed assignmentId,
        address indexed student,
        uint256 timestamp
    );

    /// @notice Modifier to ensure only teacher can call
    modifier onlyTeacher() {
        require(msg.sender == teacher, "Only teacher can call this function");
        _;
    }

    /// @notice Modifier to ensure only students can call (not teacher)
    modifier onlyStudent() {
        require(msg.sender != teacher, "Teacher cannot submit assignments");
        _;
    }

    /// @notice Constructor sets the teacher as deployer
    constructor() {
        teacher = msg.sender;
    }

    /// @notice Create a new assignment
    /// @param title The title of the assignment
    /// @param requirements The requirements/description
    /// @param deadline The deadline timestamp
    /// @return assignmentId The ID of the newly created assignment
    function createAssignment(
        string memory title,
        string memory requirements,
        uint256 deadline
    ) external onlyTeacher returns (uint256) {
        require(deadline > block.timestamp, "Deadline must be in the future");
        require(bytes(title).length > 0, "Title cannot be empty");

        uint256 assignmentId = totalAssignments;
        totalAssignments++;

        assignments[assignmentId] = Assignment({
            id: assignmentId,
            title: title,
            requirements: requirements,
            deadline: deadline,
            teacher: msg.sender,
            submissionCount: 0,
            isGrading: false
        });

        emit AssignmentCreated(assignmentId, msg.sender, title, deadline);
        return assignmentId;
    }

    /// @notice Submit an encrypted answer to an assignment
    /// @param assignmentId The ID of the assignment
    /// @param encryptedAnswer The encrypted answer
    /// @param inputProof Proof for the encrypted data
    function submitAssignment(
        uint256 assignmentId,
        externalEuint32 encryptedAnswer,
        bytes calldata inputProof
    ) external onlyStudent {
        Assignment storage assignment = assignments[assignmentId];
        require(assignment.deadline > 0, "Assignment does not exist");
        require(block.timestamp < assignment.deadline, "Deadline has passed");
        require(!submissions[assignmentId][msg.sender].exists, "Already submitted");

        // Convert external encrypted value to internal euint32
        euint32 encryptedEuint32 = FHE.fromExternal(encryptedAnswer, inputProof);
        
        // Allow contract to use this encrypted value
        FHE.allowThis(encryptedEuint32);
        // Allow teacher to decrypt (for grading after deadline)
        FHE.allow(encryptedEuint32, teacher);

        submissions[assignmentId][msg.sender] = Submission({
            student: msg.sender,
            encryptedAnswer: encryptedEuint32,
            timestamp: block.timestamp,
            exists: true
        });

        assignment.submissionCount++;

        emit SubmissionCreated(assignmentId, msg.sender, block.timestamp);
    }

    /// @notice Start grading process (can only be called after deadline)
    /// @param assignmentId The ID of the assignment
    function startGrading(uint256 assignmentId) external onlyTeacher {
        Assignment storage assignment = assignments[assignmentId];
        require(assignment.deadline > 0, "Assignment does not exist");
        require(block.timestamp >= assignment.deadline, "Deadline has not passed");
        require(!assignment.isGrading, "Grading already started");
        
        assignment.isGrading = true;
    }

    /// @notice Grade a student's submission (teacher decrypts answer, encrypts grade)
    /// @param assignmentId The ID of the assignment
    /// @param student The address of the student
    /// @param encryptedScore The encrypted score (0-100)
    /// @param inputProof Proof for the encrypted score
    function gradeSubmission(
        uint256 assignmentId,
        address student,
        externalEuint32 encryptedScore,
        bytes calldata inputProof
    ) external onlyTeacher {
        Assignment storage assignment = assignments[assignmentId];
        require(assignment.deadline > 0, "Assignment does not exist");
        require(block.timestamp >= assignment.deadline, "Deadline has not passed");
        require(submissions[assignmentId][student].exists, "Submission does not exist");
        require(!grades[assignmentId][student].exists, "Already graded");

        // Convert external encrypted score to internal euint32
        euint32 encryptedEuint32 = FHE.fromExternal(encryptedScore, inputProof);
        
        // Allow contract to use this encrypted value
        FHE.allowThis(encryptedEuint32);
        // Allow student to decrypt their own grade
        FHE.allow(encryptedEuint32, student);

        grades[assignmentId][student] = Grade({
            encryptedScore: encryptedEuint32,
            timestamp: block.timestamp,
            exists: true
        });

        emit GradeAssigned(assignmentId, student, block.timestamp);
    }

    /// @notice Get assignment details
    /// @param assignmentId The ID of the assignment
    /// @return title The title
    /// @return requirements The requirements
    /// @return deadline The deadline timestamp
    /// @return submissionCount The number of submissions
    /// @return isGrading Whether grading has started
    function getAssignment(uint256 assignmentId)
        external
        view
        returns (
            string memory title,
            string memory requirements,
            uint256 deadline,
            uint256 submissionCount,
            bool isGrading
        )
    {
        Assignment storage assignment = assignments[assignmentId];
        require(assignment.deadline > 0, "Assignment does not exist");
        
        return (
            assignment.title,
            assignment.requirements,
            assignment.deadline,
            assignment.submissionCount,
            assignment.isGrading
        );
    }

    /// @notice Get student's encrypted submission
    /// @param assignmentId The ID of the assignment
    /// @param student The address of the student
    /// @return encryptedAnswer The encrypted answer
    /// @return timestamp The submission timestamp
    /// @return exists Whether the submission exists
    function getSubmission(uint256 assignmentId, address student)
        external
        view
        returns (
            euint32 encryptedAnswer,
            uint256 timestamp,
            bool exists
        )
    {
        Submission storage submission = submissions[assignmentId][student];
        return (
            submission.encryptedAnswer,
            submission.timestamp,
            submission.exists
        );
    }

    /// @notice Get student's encrypted grade
    /// @param assignmentId The ID of the assignment
    /// @param student The address of the student
    /// @return encryptedScore The encrypted score
    /// @return timestamp The grading timestamp
    /// @return exists Whether the grade exists
    function getGrade(uint256 assignmentId, address student)
        external
        view
        returns (
            euint32 encryptedScore,
            uint256 timestamp,
            bool exists
        )
    {
        Grade storage grade = grades[assignmentId][student];
        return (
            grade.encryptedScore,
            grade.timestamp,
            grade.exists
        );
    }

    /// @notice Check if a student has submitted
    /// @param assignmentId The ID of the assignment
    /// @param student The address of the student
    /// @return Whether the student has submitted
    function hasSubmitted(uint256 assignmentId, address student)
        external
        view
        returns (bool)
    {
        return submissions[assignmentId][student].exists;
    }

    /// @notice Check if a student has been graded
    /// @param assignmentId The ID of the assignment
    /// @param student The address of the student
    /// @return Whether the student has been graded
    function hasGrade(uint256 assignmentId, address student)
        external
        view
        returns (bool)
    {
        return grades[assignmentId][student].exists;
    }
}

